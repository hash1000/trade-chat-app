const {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const path = require("path");
require("dotenv").config();

// Configure AWS S3 client for DigitalOcean Spaces
const s3Client = new S3Client({
  endpoint: process.env.SPACES_END_POINT,
  forcePathStyle: false,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

/**
 * Uploads a file to DigitalOcean Spaces.
 * @param {Object} file - The file object from multer.
 * @param {string} bucketName - The name of the bucket.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
const uploadFileToS3 = async (file, bucketName) => {
  if (!file) {
    throw new Error("No file provided");
  }
  const fileName = `${Date.now()}_${file.originalname}`;
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read",
  };
  await s3Client.send(new PutObjectCommand(params));
  return {
    title: file.originalname,
    url: `${process.env.IMAGE_END_POINT}/${fileName}`,
  };
};

/**
 * Deletes a file from DigitalOcean Spaces
 * @param {string} fileUrl - The full URL of the file to delete
 * @param {string} bucketName - The name of the bucket
 * @returns {Promise<boolean>} - True if deletion was successful
 */
const deleteFileFromS3 = async (fileUrl, bucketName) => {
  if (!fileUrl) {
    throw new Error("No file URL provided");
  }

  try {
    // Extract the key from the full URL
    const urlParts = fileUrl.split("/");
    const fileName = urlParts[urlParts.length - 1];

    const params = {
      Bucket: bucketName,
      Key: fileName,
    };

    await s3Client.send(new DeleteObjectCommand(params));
    return true;
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

module.exports = { uploadFileToS3, deleteFileFromS3 };
