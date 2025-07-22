import AWS from "aws-sdk";

export const BUCKET = "bl-whatsapp";

export const s3 = new AWS.S3({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  endpoint: process.env.R2_ENDPOINT, // e.g. https://<accountid>.r2.cloudflarestorage.com
  region: "auto",
  signatureVersion: "v4",
});
