const express = require('express');
const router = express.Router();
const { uploadMemory, uploadDisk } = require('../utilities/multer-config');
const authMiddleware = require('../middlewares/authenticate');
const multerHandler = require('../middlewares/multerHandler');
const FileController = require('../controllers/FileController');

const fileController = new FileController();
const MEMORY_LIMIT = 25 * 1024 * 1024;
const DISK_LIMIT = 50 * 1024 * 1024;

router.post('/upload', authMiddleware, async (req, res) => {
  // const contentLength = parseInt(req.headers['content-length'] || '0');

  // if (!req.headers['content-length']) {
  //   return res.status(411).json({ error: 'Content-Length header required' });
  // }
console.log("Content-Length:", req.headers['content-length']);
  if (contentLength <= MEMORY_LIMIT) {
    uploadMemory(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Upload failed', details: err.message });
      console.log("Memory upload successful");
      fileController.uploadShort(req, res);
    });
  } else if (contentLength <= DISK_LIMIT) {
    uploadDisk(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'Upload failed', details: err.message });
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
  '/short',
  multerHandler(uploadMemory, 'File exceeds 25MB limit. Use /medium or /large.'),
  fileController.uploadShort
);

router.post('/medium', multerHandler(uploadDisk, 'File exceeds 50MB limit. Use /large.'), fileController.uploadMedium.bind(fileController));
router.post('/large', fileController.uploadStream.bind(fileController));

router.delete('/:key', fileController.deleteFile.bind(fileController));
router.get('/download/:key', fileController.downloadFile.bind(fileController));

module.exports = router;
