const multer = require("multer");
const { MAX_FILE_SIZE, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } = require("./file-config");

// Configure memory storage
const storage = multer.memoryStorage();

// Enhanced file filter
const fileFilter = (req, file, cb) => {
  try {
    const ext = `.${file.originalname.split('.').pop().toLowerCase()}`;
    const mimeType = file.mimetype;

    const isAllowedType = ALLOWED_FILE_TYPES.includes(mimeType) || 
                         ALLOWED_EXTENSIONS.includes(ext);

    if (isAllowedType) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${ALLOWED_FILE_TYPES.join(', ')} files are allowed.`));
    }
  } catch (err) {
    cb(err);
  }
};

// Upload handlers with proper limits
const uploadSingle = multer({
  storage,
  // fileFilter,
  // limits: { fileSize: MAX_FILE_SIZE }
}).single('file');

const uploadMultiple = multer({
  storage,
  // fileFilter,
  limits: { 
    fileSize: MAX_FILE_SIZE,
    files: 5
  }
}).array('files', 5);

const uploadFields = multer({
  storage,
  // fileFilter,
  limits: { 
    fileSize: MAX_FILE_SIZE,
    files: 10
  }
}).fields([
  { name: 'images', maxCount: 5 },
  { name: 'documents', maxCount: 5 }
]);

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadFields
};