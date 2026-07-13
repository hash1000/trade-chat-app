const multer = require("multer");
const ProductFileService = require("../services/ProductFileService");
const productFileService = new ProductFileService();

class ShopProductFileController {
  async uploadMedia(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: "No media files uploaded." });
      }

      const records = await productFileService.uploadMedia(Number(productId), userId, req.files);

      return res.status(201).json({ success: true, data: records });
    } catch (error) {
      console.error("ShopProductFileController.uploadMedia error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const { id: userId } = req.user;

      await productFileService.deleteFile(Number(fileId), userId);

      return res.status(200).json({ success: true, message: "File deleted successfully." });
    } catch (error) {
      console.error("ShopProductFileController.deleteFile error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  handleMulterError(uploadFn) {
    return (req, res, next) => {
      uploadFn(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          const message =
            err.code === "LIMIT_FILE_SIZE"
              ? "File too large."
              : err.message || "File upload error.";
          return res.status(400).json({ success: false, error: message });
        }
        if (err) {
          return res.status(400).json({ success: false, error: err.message || "File upload error." });
        }
        next();
      });
    };
  }
}

module.exports = ShopProductFileController;
