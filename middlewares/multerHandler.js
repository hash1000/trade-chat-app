const multer = require('multer');

/**
 * Wrapper for multer to handle errors consistently
 * @param {*} upload - multer upload instance (e.g., uploadMemory)
 * @param {*} errorMessage - optional custom error message
 */
const multerHandler = (upload, errorMessage = '') => {
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            status: 'error',
            message: errorMessage || 'File too large. Please use an appropriate endpoint.',
          });
        }
        return res.status(400).json({
          status: 'error',
          message: 'Upload failed due to a Multer error.',
          details: err.message,
        });
      } else if (err) {
        return res.status(500).json({
          status: 'error',
          message: 'Unexpected error during file upload.',
          details: err.message,
        });
      }

      // No errors, continue
      next();
    });
  };
};

module.exports = multerHandler;
