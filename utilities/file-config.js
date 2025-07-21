const isVideo = (ext) =>
  ["mp4", "mov", "avi", "flv", "wmv", "webm", "mpg", "mpeg", "mkv"].includes(
    ext
  );

const isImage = (ext) =>
  ["jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp"].includes(ext);

const isDocument = (ext) =>
  ["pdf", "doc", "docx", "xls", "xlsx", "txt", "ppt", "pptx"].includes(ext);

// File size limits
const MAX_FILE_SIZE_MEMORY = 25 * 1024 * 1024; // 25MB
const MAX_FILE_SIZE_DISK = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE_STREAM = 5000 * 1024 * 1024; // 5GB

// Allowed MIME types
const ALLOWED_FILE_TYPES = [
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/svg+xml",
  "image/webp",
  // Videos
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-flv",
  "video/x-ms-wmv",
  "video/webm",
  "video/mpeg",
  "video/x-matroska",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Text
  "text/plain",
  // Archives
  "application/zip",
  "application/x-rar-compressed",
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".mp4",
  ".mov",
  ".avi",
  ".flv",
  ".wmv",
  ".webm",
  ".mpg",
  ".mpeg",
  ".mkv",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".zip",
  ".rar",
];

module.exports = {
  isVideo,
  isImage,
  isDocument,
  MAX_FILE_SIZE_MEMORY,
  MAX_FILE_SIZE_DISK,
  MAX_FILE_SIZE_STREAM,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
};
