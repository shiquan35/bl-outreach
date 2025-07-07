import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import { google, drive_v3 } from "googleapis";

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Google Drive API setup using environment variables
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

// Types
interface DriveAuthResult {
  oAuth2Client?: any;
  needsAuth?: boolean;
}

interface SearchQuery {
  q?: string;
  maxResults?: string;
}

interface AdvancedSearchBody {
  name?: string;
  mimeType?: string;
  parentId?: string;
  fullText?: string;
  maxResults?: number;
  trashed?: boolean;
}

interface FileResult {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  createdTime: string;
  modifiedTime: string;
  parents?: string[] | null;
  webViewLink?: string | null;
}

// Initialize Google Drive API using Service Account
async function initializeDriveAPI(): Promise<drive_v3.Drive | DriveAuthResult> {
  try {
    // Method 1: Using Service Account (Recommended for server-to-server)
    if (
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY
    ) {
      // Alternative approach using JWT directly
      const jwtClient = new google.auth.JWT(
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        undefined,
        process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        SCOPES
      );

      await jwtClient.authorize();
      return google.drive({ version: "v3", auth: jwtClient });
    }

    // Method 2: Using OAuth2 with environment variables
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
      );

      // Check if we have stored tokens in environment variables
      if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN) {
        oAuth2Client.setCredentials({
          access_token: process.env.GOOGLE_ACCESS_TOKEN,
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });
        return google.drive({ version: "v3", auth: oAuth2Client });
      }

      // Return OAuth client for authorization flow
      return { oAuth2Client, needsAuth: true };
    }

    throw new Error("Missing Google API credentials in environment variables");
  } catch (error) {
    console.error("Error initializing Google Drive API:", error);
    throw error;
  }
}

// Search files in Google Drive
async function searchFiles(
  drive: drive_v3.Drive,
  query: string,
  maxResults: number = 10
): Promise<drive_v3.Schema$File[]> {
  try {
    const response = await drive.files.list({
      q: query,
      pageSize: maxResults,
      fields:
        "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents, webViewLink)",
    });

    return response.data.files || [];
  } catch (error) {
    console.error("Error searching files:", error);
    throw error;
  }
}

// Helper function to check if result is a Drive instance
function isDriveInstance(
  result: drive_v3.Drive | DriveAuthResult
): result is drive_v3.Drive {
  return !("needsAuth" in result);
}

// Routes
app.get("/", (_req: Request, res: Response): void => {
  res.json({
    message: "Google Drive Search API",
    endpoints: {
      search: "/search?q=query",
      advancedSearch: "/search/advanced (POST)",
      fileDetails: "/file/:fileId",
      auth: "/auth (if using OAuth2)",
    },
  });
});

// Route to get authorization URL (only needed for OAuth2 flow)
app.get("/auth", async (req: Request, res: Response): Promise<void> => {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      res.json({
        message:
          "Using Service Account authentication. No manual authorization needed.",
      });
      return;
    }

    const driveOrAuth = await initializeDriveAPI();
    if (!isDriveInstance(driveOrAuth) && driveOrAuth.needsAuth) {
      const authUrl = driveOrAuth.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
      });

      res.json({
        message: "Please visit this URL to authorize the application:",
        authUrl,
      });
    } else {
      res.json({ message: "Already authorized!" });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// Route to handle OAuth callback and display tokens
app.get(
  "/auth/callback",
  async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query as { code?: string };

    if (!code) {
      res.status(400).json({ error: "Authorization code not provided" });
      return;
    }

    try {
      const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/callback"
      );

      const { tokens } = await oAuth2Client.getToken(code);

      res.json({
        message:
          "Authorization successful! Add these to your environment variables:",
        tokens: {
          GOOGLE_ACCESS_TOKEN: tokens.access_token,
          GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
        },
      });
    } catch (error) {
      console.error("Error retrieving access token:", error);
      res.status(500).json({ error: "Failed to retrieve access token" });
    }
  }
);

// Route to search files
app.get("/search", async (req: Request, res: Response): Promise<void> => {
  const query = req.query as SearchQuery;
  const { q, maxResults = "10" } = query;

  if (!q) {
    res.status(400).json({ error: "Search query 'q' parameter is required" });
    return;
  }

  try {
    const driveOrAuth = await initializeDriveAPI();

    if (!isDriveInstance(driveOrAuth)) {
      res.status(401).json({
        error:
          "Authorization required. Please visit /auth to get authorization URL.",
        authUrl: "/auth",
      });
      return;
    }

    const files = await searchFiles(driveOrAuth, q, parseInt(maxResults));

    const formattedFiles: FileResult[] = files.map((file) => ({
      id: file.id || "",
      name: file.name || "",
      mimeType: file.mimeType || "",
      size: file.size || null,
      createdTime: file.createdTime || "",
      modifiedTime: file.modifiedTime || "",
      parents: file.parents || null,
      webViewLink: file.webViewLink || null,
    }));

    res.json({
      query: q,
      results: formattedFiles.length,
      files: formattedFiles,
    });
  } catch (error) {
    console.error("Search error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .json({ error: "Failed to search files", details: errorMessage });
  }
});

// Route to search files with specific filters
app.post(
  "/search/advanced",
  async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      mimeType,
      parentId,
      fullText,
      maxResults = 10,
      trashed = false,
    } = req.body as AdvancedSearchBody;

    try {
      const driveOrAuth = await initializeDriveAPI();

      if (!isDriveInstance(driveOrAuth)) {
        res.status(401).json({
          error:
            "Authorization required. Please visit /auth to get authorization URL.",
          authUrl: "/auth",
        });
        return;
      }

      // Build query string
      const query: string[] = [];

      if (name) {
        query.push(`name contains '${name}'`);
      }

      if (mimeType) {
        query.push(`mimeType = '${mimeType}'`);
      }

      if (parentId) {
        query.push(`'${parentId}' in parents`);
      }

      if (fullText) {
        query.push(`fullText contains '${fullText}'`);
      }

      query.push(`trashed = ${trashed}`);

      const queryString = query.join(" and ");

      const files = await searchFiles(driveOrAuth, queryString, maxResults);

      const formattedFiles: FileResult[] = files.map((file) => ({
        id: file.id || "",
        name: file.name || "",
        mimeType: file.mimeType || "",
        size: file.size || null,
        createdTime: file.createdTime || "",
        modifiedTime: file.modifiedTime || "",
        parents: file.parents || null,
        webViewLink: file.webViewLink || null,
      }));

      res.json({
        query: queryString,
        results: formattedFiles.length,
        files: formattedFiles,
      });
    } catch (error) {
      console.error("Advanced search error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to perform advanced search",
        details: errorMessage,
      });
    }
  }
);

// Route to get file details by ID
app.get("/file/:fileId", async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params;

  try {
    const driveOrAuth = await initializeDriveAPI();

    if (!isDriveInstance(driveOrAuth)) {
      res.status(401).json({
        error:
          "Authorization required. Please visit /auth to get authorization URL.",
        authUrl: "/auth",
      });
      return;
    }

    const file = await driveOrAuth.files.get({
      fileId: fileId,
      fields:
        "id, name, mimeType, size, createdTime, modifiedTime, parents, description, starred, webViewLink",
    });

    res.json(file.data);
  } catch (error) {
    console.error("Get file error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res
      .status(500)
      .json({ error: "Failed to get file details", details: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`
Setup Instructions:

METHOD 1 - Service Account (Recommended for production):
1. Go to Google Cloud Console
2. Create a Service Account
3. Download the service account key JSON
4. Add these to your .env file:
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n"

METHOD 2 - OAuth2 (For personal use):
1. Go to Google Cloud Console
2. Create OAuth2 credentials
3. Add these to your .env file:
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
4. Visit /auth to get tokens, then add:
   GOOGLE_ACCESS_TOKEN=your-access-token
   GOOGLE_REFRESH_TOKEN=your-refresh-token

Example searches:
- GET /search?q=name contains 'test'
- GET /search?q=mimeType = 'application/pdf'
- POST /search/advanced with JSON body: {"name": "report", "mimeType": "application/pdf"}
  `);
});
