const multer = require("multer");
const path = require("path");
const os = require("os");

const ALLOWED_MEDIA_MIMES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
  "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const ALLOWED_MEDIA_EXTS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff",
  ".mp4", ".mpeg", ".mov", ".avi", ".mkv", ".webm",
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt",
];

const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `addon_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

function mediaFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype) || !ALLOWED_MEDIA_EXTS.includes(ext)) {
    return cb(new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE",
      "File type not allowed. Accepted: images, videos, pdf, doc, docx, ppt, pptx, xls, xlsx, txt."
    ));
  }
  cb(null, true);
}

// POST /add-ons/:addOnId/files — single file upload with field name "file"
const uploadAddOnFile = multer({
  storage: tempStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
}).single("file");

module.exports = { uploadAddOnFile };
