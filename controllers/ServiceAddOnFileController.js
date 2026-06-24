const multer = require("multer");
const ServiceAddOnFileService = require("../services/ServiceAddOnFileService");

const serviceAddOnFileService = new ServiceAddOnFileService();

class ServiceAddOnFileController {
  /**
   * GET /add-ons/:addOnId/files
   * List files for an add-on sorted by sort_order asc.
   */
  async listFiles(req, res) {
    try {
      const addOnId = Number(req.params.addOnId);
      const files = await serviceAddOnFileService.listFiles(addOnId);
      return res.status(200).json({ success: true, data: files });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnFileController.listFiles");
    }
  }

  /**
   * POST /add-ons/:addOnId/files
   * Upload a file for an add-on. Multipart/form-data with field "file".
   */
  async uploadFile(req, res) {
    try {
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded. Use field name 'file'." });
      }

      const record = await serviceAddOnFileService.uploadFile(addOnId, actorId, req.file);

      return res.status(201).json({ success: true, data: record });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnFileController.uploadFile");
    }
  }

  /**
   * DELETE /add-ons/:addOnId/files/:fileId
   * Delete a file and remove from S3.
   */
  async deleteFile(req, res) {
    try {
      const addOnId = Number(req.params.addOnId);
      const fileId = Number(req.params.fileId);
      const actorId = req.user.id;

      await serviceAddOnFileService.deleteFile(addOnId, fileId, actorId);

      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "ServiceAddOnFileController.deleteFile");
    }
  }

  /**
   * PUT /add-ons/:addOnId/files/:fileId/reorder
   * Update sort_order for a file.
   */
  async reorderFile(req, res) {
    try {
      const addOnId = Number(req.params.addOnId);
      const fileId = Number(req.params.fileId);
      const actorId = req.user.id;
      const { sort_order } = req.body;

      if (sort_order === undefined || sort_order === null) {
        return res.status(400).json({ success: false, error: "sort_order is required." });
      }

      const file = await serviceAddOnFileService.reorderFile(addOnId, fileId, actorId, sort_order);

      return res.status(200).json({ success: true, data: file });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnFileController.reorderFile");
    }
  }

  /**
   * Wraps a multer upload function and returns an Express middleware that
   * converts MulterErrors to JSON 400 responses instead of crashing.
   * @param {Function} uploadFn
   * @returns {import('express').RequestHandler}
   */
  handleMulterError(uploadFn) {
    return (req, res, next) => {
      uploadFn(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          const message =
            err.code === "LIMIT_FILE_SIZE"
              ? "File too large. Maximum size is 100 MB."
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

/**
 * @param {import('express').Response} res
 * @param {Error & { statusCode?: number }} error
 * @param {string} context
 */
function handleError(res, error, context) {
  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = ServiceAddOnFileController;
