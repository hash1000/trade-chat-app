const multer = require("multer");
const path = require("path");

const ALLOWED_IMAGE_MIMES = [
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
];

const ALLOWED_IMAGE_EXTS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff",
];

// Matches the memory limit of POST /file/short, whose upload path we reuse
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 10;

function imageFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype) || !ALLOWED_IMAGE_EXTS.includes(ext)) {
    return cb(new multer.MulterError(
      "LIMIT_UNEXPECTED_FILE",
      "File type not allowed. Accepted images: jpg, jpeg, png, webp, gif, bmp, tiff."
    ));
  }
  cb(null, true);
}

// Kept in memory so the buffer can go straight to uploadMemoryFileToS3, the
// same call POST /file/short makes to store the image and build its thumbnail.
const uploadShopImages = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_GALLERY_IMAGES + 2 },
}).fields([
  { name: "header_image", maxCount: 1 },
  { name: "profile_image", maxCount: 1 },
  { name: "multiple_images", maxCount: MAX_GALLERY_IMAGES },
]);

module.exports = { uploadShopImages, MAX_GALLERY_IMAGES, MAX_IMAGE_SIZE };
