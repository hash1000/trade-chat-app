const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"];
const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"];

const ALLOWED_MEDIA_MIMES = [
  // images
  ...ALLOWED_IMAGE_MIMES,
  // videos
  "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/x-matroska", "video/webm",
  // documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const ALLOWED_MEDIA_EXTS = [
  ...ALLOWED_IMAGE_EXTS,
  ".mp4", ".mpeg", ".mov", ".avi", ".mkv", ".webm",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt",
];

const IMAGE_DIR = path.join(__dirname, "../uploads/services/images");
const MEDIA_DIR = path.join(__dirname, "../uploads/services/media");

[IMAGE_DIR, MEDIA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function makeStorage(destination) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  });
}

function imageFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype) || !ALLOWED_IMAGE_EXTS.includes(ext)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only image files (jpg, jpeg, png, webp, gif, bmp, tiff) are allowed."));
  }
  cb(null, true);
}

function mediaFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype) || !ALLOWED_MEDIA_EXTS.includes(ext)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "File type not allowed. Accepted: images, videos, pdf, doc, docx, xls, xlsx, ppt, pptx, txt."));
  }
  cb(null, true);
}

// Used on POST /services (create) — optional images field
const uploadServiceImages = multer({
  storage: makeStorage(IMAGE_DIR),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
}).array("images");

// Used on POST /services/:serviceId/media — images + videos + documents
const uploadServiceMedia = multer({
  storage: makeStorage(MEDIA_DIR),
  fileFilter: mediaFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 20 },
}).array("media");

module.exports = { uploadServiceImages, uploadServiceMedia };
