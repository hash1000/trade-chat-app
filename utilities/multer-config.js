// multerConfig.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Size limits
const MEMORY_LIMIT = 25 * 1024 * 1024; // 25MB
const DISK_LIMIT = 50 * 1024 * 1024; // 50MB

const uploadDir = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}${ext}`);
  }
});

const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedTypes = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
    '.mp4', '.mov', '.avi', '.mkv', '.webm',  // Videos
    '.pdf', '.doc', '.docx', '.xls', '.xlsx'  // Documents
  ];
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not allowed`), false);
  }
};

const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: MEMORY_LIMIT }
}).single('file');

const uploadDisk = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: DISK_LIMIT }
}).single('file');

// Middleware wrapper for error handling
const multerHandler = (upload, sizeErrorMessage) => {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: sizeErrorMessage });
        }
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  };
};

module.exports = {
  uploadMemory,
  uploadDisk,
  multerHandler,
  MEMORY_LIMIT,
  DISK_LIMIT
};