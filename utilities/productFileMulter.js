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

// Save to OS temp dir — files are read, uploaded to S3, then deleted
const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prod_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const ALLOWED_IMAGE_MIMES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
];

const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"];

// Gallery images for a variation ride along on product create/update as
// variation_images_<i>, where <i> is the variation's index in the variations array.
// A flat multipart body cannot nest, so the index is what ties the two together.
const VARIATION_IMAGE_FIELD = /^variation_images_(\d+)$/;

// These fields hold pictures, not arbitrary media, so they are held to images only
const isImageOnlyField = (fieldname) =>
  fieldname === "productImages" ||
  fieldname === "images" ||
  VARIATION_IMAGE_FIELD.test(fieldname);

// MulterError's second argument is the offending *field*, not a message — passing
// text there silently yields "Unexpected field", so the message is set explicitly.
function rejectFile(field, message) {
  const err = new multer.MulterError("LIMIT_UNEXPECTED_FILE", field);
  err.message = message;
  return err;
}

function mediaFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (isImageOnlyField(file.fieldname)) {
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype) || !ALLOWED_IMAGE_EXTS.includes(ext)) {
      return cb(rejectFile(
        file.fieldname,
        `${file.fieldname} accepts images only: jpg, jpeg, png, webp, gif, bmp, tiff.`
      ));
    }
    return cb(null, true);
  }

  if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype) || !ALLOWED_MEDIA_EXTS.includes(ext)) {
    return cb(rejectFile(
      file.fieldname,
      "File type not allowed. Accepted: images, videos, pdf, doc, docx, ppt, pptx, xls, xlsx, txt."
    ));
  }
  cb(null, true);
}

// POST /shopProduct/:productId/media
const uploadProductMedia = multer({
  storage: tempStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 500 * 1024 * 1024, files: 20 },
}).array("media");

// POST/PUT /shopProduct — create and update.
// .any() rather than .fields() because variation_images_<i> names are only known
// at request time: the client decides how many variations it is sending.
const uploadProductCreateUpdate = multer({
  storage: tempStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 500 * 1024 * 1024, files: 60 },
}).any();

// POST/PUT /shopProduct/:productId/variations/:variationId — images[] for one variation
const uploadVariationImages = multer({
  storage: tempStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 500 * 1024 * 1024, files: 10 },
}).array("images", 10);

// POST/PUT .../add-ons — images[] for one add-on
const uploadAddOnImages = multer({
  storage: tempStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 500 * 1024 * 1024, files: 10 },
}).array("images", 10);

// Groups multer's .any() output ({fieldname, path, ...}[]) back into
// { media: [...], productImages: [...], variationImages: { 0: [...], 1: [...] } }
function groupProductFiles(files) {
  const grouped = { media: [], productImages: [], variationImages: {} };
  if (!Array.isArray(files)) return grouped;

  for (const file of files) {
    const variation = VARIATION_IMAGE_FIELD.exec(file.fieldname);
    if (variation) {
      const index = Number(variation[1]);
      (grouped.variationImages[index] ??= []).push(file);
    } else if (file.fieldname === "productImages") {
      grouped.productImages.push(file);
    } else if (file.fieldname === "media") {
      grouped.media.push(file);
    }
  }

  return grouped;
}

module.exports = {
  uploadProductMedia,
  uploadProductCreateUpdate,
  uploadVariationImages,
  uploadAddOnImages,
  groupProductFiles,
};
