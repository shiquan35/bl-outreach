import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import AWS from "aws-sdk";
import { getCondoPackages } from "./functions/getCondoPackages";
import { sendWhatsapp } from "./functions/sendWhatsapp";

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove local S3 client and BUCKET config, as they are now in s3Client.ts and not used directly here.

app.post("/search-images", async (req: Request, res: Response) => {
  const { agentName, condoName, sqft, phoneNumber, fullCondoName } = req.body;
  if (!agentName || !condoName || !sqft || !phoneNumber || !fullCondoName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const message = `Hi ${agentName}, this is Brandon from Bright Living, I got your contact through PropertyGuru and we have lighting packages for ${fullCondoName} & other newly-TOP condo projects. These are the lighting packages for the units that you are renting out for.\nThank you and have a good week ahead.`;

  try {
    const mediaURLs = await getCondoPackages({ condoName, sqft });
    await sendWhatsapp({ phoneNumber, message, mediaURLs });
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: (err as Error).message || "Failed to send message" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
