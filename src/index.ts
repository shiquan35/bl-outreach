import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import AWS from "aws-sdk";
import { getCondoPackages } from "./functions/getCondoPackages";

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove local S3 client and BUCKET config, as they are now in s3Client.ts and not used directly here.

app.post("/search-images", async (req: Request, res: Response) => {
  const { agentName, condoName, sqft } = req.body;
  if (!agentName || !condoName || !sqft) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const mediaURLs = await getCondoPackages({ condoName, sqft });
    res.json({ mediaURLs });
  } catch (err) {
    res
      .status(500)
      .json({ error: (err as Error).message || "Failed to search images" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
