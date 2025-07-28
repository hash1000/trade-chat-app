const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Size limits
const MEMORY_LIMIT = 25 * 1024 * 1024; // 25MB
const DISK_LIMIT = 5000 * 1024 * 1024; // 50MB
const STREAM_LIMIT = 1024 * 1024 * 1024; // 1GB

const uploadDir = path.join(__dirname, "../uploads");

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
  },
});

// Storage instances
const memoryStorage = multer.memoryStorage();

// File filter
const videoFileFilter = (req, cb) => {
  const fileType = req.body.type;
  if (fileType === "video") {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// Upload handlers
const uploadMemory = multer({
  storage: memoryStorage,
  // fileFilter,
  limits: { fileSize: MEMORY_LIMIT },
}).single("file");

const uploadAwsMemory = multer({
  storage: memoryStorage,
  // fileFilter,
  limits: { fileSize: DISK_LIMIT },
}).single("file");

const uploadDisk = multer({
  storage: diskStorage,
  // fileFilter,
  limits: { fileSize: DISK_LIMIT },
}).single("file");

const uploadDiskCloudinary = multer({
  storage: diskStorage,
  videoFileFilter,
  limits: { fileSize: DISK_LIMIT },
}).single("file");

const uploadMultipleDisk = multer({
  storage: diskStorage,
  limits: { fileSize: DISK_LIMIT, files: 5 },
}).array("files", 5);

module.exports = {
  uploadMemory,
  uploadDisk,
  uploadAwsMemory,
  uploadDiskCloudinary,
  uploadMultipleDisk,
  MEMORY_LIMIT,
  DISK_LIMIT,
  STREAM_LIMIT,
};
