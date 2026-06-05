const multer = require("multer");
const path = require("path");
const fs = require("fs");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"];
const DOC_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".ppt", ".pptx"];

const IMAGE_DIR = path.join(__dirname, "../uploads/services/images");
const DOC_DIR = path.join(__dirname, "../uploads/services/documents");

[IMAGE_DIR, DOC_DIR].forEach((dir) => {
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
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype) || !IMAGE_EXTENSIONS.includes(ext)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only jpg, jpeg, png, webp images are allowed."));
  }
  cb(null, true);
}

function docFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_DOC_TYPES.includes(file.mimetype) || !DOC_EXTENSIONS.includes(ext)) {
    return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "Only pdf, doc, docx files are allowed."));
  }
  cb(null, true);
}

const uploadServiceImages = multer({
  storage: makeStorage(IMAGE_DIR),
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
}).array("images");

const uploadServiceDocuments = multer({
  storage: makeStorage(DOC_DIR),
  fileFilter: docFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
}).array("documents");

module.exports = { uploadServiceImages, uploadServiceDocuments };
