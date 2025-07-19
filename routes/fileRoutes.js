const express = require("express");
const router = express.Router();
const {
  uploadMemory,
  uploadDisk,
  uploadDiskCloudinary,
  uploadAwsMemory,
} = require("../utilities/multer-config");
const authMiddleware = require("../middlewares/authenticate");
const multerHandler = require("../middlewares/multerHandler");
const FileController = require("../controllers/FileController");
const { uploadLargeFileToS3 } = require("../utilities/s3Utils");

const fileController = new FileController();
const MEMORY_LIMIT = 25 * 1024 * 1024;
const DISK_LIMIT = 50 * 1024 * 1024;

router.post("/upload", authMiddleware, async (req, res) => {
  // const contentLength = parseInt(req.headers['content-length'] || '0');

  // if (!req.headers['content-length']) {
  //   return res.status(411).json({ error: 'Content-Length header required' });
  // }
  console.log("Content-Length:", req.headers["content-length"]);
  if (contentLength <= MEMORY_LIMIT) {
    uploadMemory(req, res, (err) => {
      if (err)
        return res
          .status(400)
          .json({ error: "Upload failed", details: err.message });
      console.log("Memory upload successful");
      fileController.uploadShort(req, res);
    });
  } else if (contentLength <= DISK_LIMIT) {
    uploadDisk(req, res, (err) => {
      if (err)
        return res
          .status(400)
          .json({ error: "Upload failed", details: err.message });
      console.log("Disk upload successful");
      fileController.uploadMedium(req, res);
    });
  } else {
    console.log("stream upload successful");
    fileController.uploadStream(req, res);
  }
});

// Direct routes (optional use case)
router.post(
  "/short",
  multerHandler(
    uploadMemory,
    "File exceeds 25MB limit. Use /medium or /large."
  ),
  fileController.uploadShort
);

router.post(
  "/medium",
  multerHandler(uploadDisk, "File exceeds 50MB limit. Use /large."),
  fileController.uploadMedium.bind(fileController)
);
router.post(
  "/large",
  multerHandler(uploadDisk, "File exceeds 50MB limit. Use /large."),
  fileController.uploadStream.bind(fileController)
);

router.post(
  "/aws-large",
  multerHandler(uploadAwsMemory, "File exceeds ."),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const { originalname, buffer, mimetype } = req.file;

      const fileType = req.body.type;

      const result = await uploadLargeFileToS3({
        fileBuffer: buffer,
        fileName: originalname,
        mimetype,
        fileType,
      });

      res.status(200).json({
        message: "File uploaded successfully to AWS S3",
        data: result,
      });
    } catch (err) {
      console.error("AWS Large Upload Error:", err);
      res.status(500).json({ error: "Upload failed", details: err.message });
    }
  }
);
router.post(
  "/cloudinary",
  multerHandler(uploadDiskCloudinary, "File must be a video"),
  fileController.uploadToCloudinary.bind(fileController)
);

router.delete("/:key", fileController.deleteFile.bind(fileController));
router.get("/download/:key", fileController.downloadFile.bind(fileController));

module.exports = router;
