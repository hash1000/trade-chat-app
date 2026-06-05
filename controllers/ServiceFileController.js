const multer = require("multer");
const ServiceFileService = require("../services/ServiceFileService");
const serviceFileService = new ServiceFileService();

class ServiceFileController {
  async uploadImages(req, res) {
    try {
      const { serviceId } = req.params;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: "No image files uploaded." });
      }

      const records = await serviceFileService.uploadImages(Number(serviceId), req.files);

      return res.status(201).json({ success: true, data: records });
    } catch (error) {
      console.error("ServiceFileController.uploadImages error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async uploadDocuments(req, res) {
    try {
      const { serviceId } = req.params;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: "No document files uploaded." });
      }

      const records = await serviceFileService.uploadDocuments(Number(serviceId), req.files);

      return res.status(201).json({ success: true, data: records });
    } catch (error) {
      console.error("ServiceFileController.uploadDocuments error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getServiceDetails(req, res) {
    try {
      const { serviceId } = req.params;

      const data = await serviceFileService.getServiceWithFiles(Number(serviceId));

      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("ServiceFileController.getServiceDetails error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;

      await serviceFileService.deleteFile(Number(fileId));

      return res.status(200).json({ success: true, message: "File deleted successfully." });
    } catch (error) {
      console.error("ServiceFileController.deleteFile error:", error);

      if (error.statusCode) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // Multer error wrapper — call this in routes instead of raw multer
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

module.exports = ServiceFileController;
