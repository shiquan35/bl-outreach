import { s3, BUCKET } from "./s3Client";

export const getCondoPackages = async ({
  condoName,
  sqft,
}: {
  condoName: string;
  sqft: string;
}) => {
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
    return matchingFiles;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to search images");
  }
};
