import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import AWS from "aws-sdk";

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cloudflare R2 S3-compatible config
const s3 = new AWS.S3({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  endpoint: process.env.R2_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com
  region: "auto",
  signatureVersion: "v4",
});

const BUCKET = "bl-whatsapp";

app.post("/search-images", async (req: Request, res: Response) => {
  const { agentName, condoName, sqft } = req.body;
  console.log("Received request:", req.body);
  if (!agentName || !condoName || !sqft) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    // List all objects in the specified condo folder
    const prefix = `${condoName}/`;
    const listParams = {
      Bucket: BUCKET,
      Prefix: prefix,
    };
    const listedObjects = await s3.listObjectsV2(listParams).promise();
    const matchingFiles = (listedObjects.Contents || [])
      .filter((obj) => obj.Key && obj.Key.includes(`${sqft}sqft`))
      .map((obj) => {
        // Replace whitespaces with %20 for proper URL encoding
        const encodedKey = obj.Key ? obj.Key.replace(/\s/g, "%20") : "";
        return `https://zynarvis.com/${encodedKey}`;
      });
    res.json({ mediaURLs: matchingFiles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search images" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
