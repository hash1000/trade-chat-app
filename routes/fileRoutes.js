const { PassThrough } = require('stream');
const express = require("express");
const router = express.Router();
const { uploadSingle } = require("../utilities/multer-config");
const { uploadFileToS3, deleteFileFromS3 } = require("../utilities/s3Utils");
const authMiddleware = require("../middlewares/authenticate");

// Unified upload endpoint
router.post("/", uploadSingle, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    
    // Create a new stream from the buffer
    const bufferStream = new PassThrough();
    bufferStream.end(buffer);

    const result = await uploadFileToS3(bufferStream, originalname, mimetype, size);

    res.status(200).json({
      message: "File uploaded successfully",
      data: result
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ 
      error: "File upload failed",
      details: error.message 
    });
  }
});

// Delete endpoint
router.delete("/:key", authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    await deleteFileFromS3(key);
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ 
      error: "File deletion failed",
      details: error.message 
    });
  }
});

// Download endpoint
router.get("/download/:key", authMiddleware, async (req, res) => {
  try {
    const { key } = req.params;
    const command = new GetObjectCommand({
      Bucket: process.env.SPACES_BUCKET_NAME,
      Key: key,
    });

    const { Body, ContentType } = await s3Client.send(command);
    
    res.setHeader("Content-Type", ContentType);
    res.setHeader("Content-Disposition", `attachment; filename="${key}"`);
    
    Body.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ 
      error: "File download failed",
      details: error.message 
    });
  }
});

module.exports = router;