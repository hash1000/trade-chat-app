const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  PutObjectCommand,
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const authMiddleware = require("../middlewares/authenticate"); // Adjust the path as needed

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 25000000 },
});

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


// Express route for file upload
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    // Check if file is present
    if (!file) {
      return res.status(400).json({ error: "No file was uploaded" });
    }
    // Create a new file name with the user id, timestamp, and the original file extension
    const fileName = `${Date.now()}${path.extname(file.originalname)}`;

    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: "public-read",
    };
    await s3Client.send(new PutObjectCommand(params));

    res.status(200).json({
      message: "File uploaded successfully",
      fileName: `${process.env.IMAGE_END_POINT}/${fileName}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while uploading the file" });
  }
});

// Express route for image upload
router.post("/image", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    // Check if file is present
    if (!file) {
      return res.status(400).json({ error: "No image was uploaded" });
    }

    // Allowed file extensions
    const fileTypes = /jpeg|jpg|png|gif|svg/;
    // Check extension names
    const extName = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = fileTypes.test(file.mimetype);

    if (mimeType && extName) {
      const fileName = `${Date.now()}${path.extname(file.originalname)}`;

      const params = {
        Bucket: process.env.SPACES_BUCKET_NAME,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      };
      await s3Client.send(new PutObjectCommand(params));

      res.status(200).json({
        message: "Image uploaded successfully",
        fileName: `${process.env.IMAGE_END_POINT}/${fileName}`
      });
    } else {
      res.status(400).json({ error: "Error: You can only upload images!" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while uploading the image" });
  }
});

// Express route for file deletion
router.delete("/delete", authMiddleware, async (req, res) => {
  try {
    const fileName = req.body.url; // Get the URL from the request body

    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName,
    };

    await s3Client.send(new DeleteObjectCommand(params));

    res.status(200).json({ message: "File deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while deleting the file" });
  }
});

// Express route for file download
router.get("/download", authMiddleware, async (req, res) => {
  try {
    const fileName = req.query.filename; // Get the file name from the query parameters

    const params = {
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: fileName,
    };

    const object = await s3Client.send(new GetObjectCommand(params));

    res.attachment(fileName);
    res.setHeader("Content-Length", object.ContentLength);

    // Pipe the file stream to the response
    object.Body.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An error occurred while downloading the file" });
  }
});

// Error-handling middleware
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 25MB." });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
