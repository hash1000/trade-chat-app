const path = require("path");
const fs = require("fs").promises;
const { Service, ServiceAddOn, ServiceAddOnFile } = require("../models");
const { uploadDiskFileToS3, deleteFileFromS3 } = require("../utilities/s3Utils");

const EXT_TO_FILE_TYPE = {
  ".jpg":  "image",
  ".jpeg": "image",
  ".png":  "image",
  ".webp": "image",
  ".gif":  "image",
  ".bmp":  "image",
  ".tiff": "image",
  ".mp4":  "video",
  ".mpeg": "video",
  ".mov":  "video",
  ".avi":  "video",
  ".mkv":  "video",
  ".webm": "video",
  ".pdf":  "pdf",
  ".doc":  "doc",
  ".docx": "docx",
  ".ppt":  "ppt",
  ".pptx": "pptx",
  ".xls":  "xls",
  ".xlsx": "xlsx",
  ".txt":  "txt",
};

const S3_FILE_TYPE = { image: "image", video: "video" };

class ServiceAddOnFileService {
  /**
   * Assert the add-on exists and belongs to the given service. Returns the add-on.
   * @param {number} addOnId
   * @param {number|null} serviceId - optional extra ownership check
   * @returns {Promise<ServiceAddOn>}
   */
  async assertAddOnExists(addOnId, serviceId = null) {
    const where = { id: addOnId, deletedAt: null };
    if (serviceId !== null) where.serviceId = serviceId;

    const addOn = await ServiceAddOn.findOne({ where });
    if (!addOn) {
      const err = new Error("Add-on not found.");
      err.statusCode = 404;
      throw err;
    }
    return addOn;
  }

  /**
   * Assert current user is the owner of the service that owns the add-on.
   * @param {ServiceAddOn} addOn
   * @param {number} userId
   * @returns {Promise<void>}
   */
  async assertOwnerViaAddOn(addOn, userId) {
    const service = await Service.findByPk(addOn.serviceId, { attributes: ["userId"] });
    if (!service || service.userId !== userId) {
      const err = new Error("Forbidden. Only the service owner can manage add-on files.");
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * List files for an add-on, sorted by sort_order asc.
   * @param {number} addOnId
   * @returns {Promise<ServiceAddOnFile[]>}
   */
  async listFiles(addOnId) {
    await this.assertAddOnExists(addOnId);

    return ServiceAddOnFile.findAll({
      where: { addOnId },
      order: [["sort_order", "ASC"]],
    });
  }

  /**
   * Upload a file for an add-on and store in S3.
   * @param {number} addOnId
   * @param {number} actorId
   * @param {Express.Multer.File} file
   * @returns {Promise<ServiceAddOnFile>}
   */
  async uploadFile(addOnId, actorId, file) {
    const addOn = await this.assertAddOnExists(addOnId);
    await this.assertOwnerViaAddOn(addOn, actorId);

    const ext = path.extname(file.originalname).toLowerCase();
    const file_type = EXT_TO_FILE_TYPE[ext] || "other";
    const s3FileType = S3_FILE_TYPE[file_type] ?? null;

    const maxSortOrder = await ServiceAddOnFile.max("sort_order", { where: { addOnId } });
    const sort_order = (maxSortOrder != null ? maxSortOrder : -1) + 1;

    let file_url, s3_key;
    try {
      const result = await uploadDiskFileToS3(
        file.path,
        file.originalname,
        file.mimetype,
        s3FileType
      );
      file_url = result.url;
      s3_key = result.key;
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }

    return ServiceAddOnFile.create({
      addOnId,
      file_url,
      file_name: file.originalname,
      file_type,
      s3_key,
      sort_order,
    });
  }

  /**
   * Delete a file record and remove it from S3.
   * @param {number} addOnId
   * @param {number} fileId
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async deleteFile(addOnId, fileId, actorId) {
    const addOn = await this.assertAddOnExists(addOnId);
    await this.assertOwnerViaAddOn(addOn, actorId);

    const file = await ServiceAddOnFile.findOne({ where: { id: fileId, addOnId } });
    if (!file) {
      const err = new Error("File not found.");
      err.statusCode = 404;
      throw err;
    }

    if (file.s3_key) {
      await deleteFileFromS3(file.s3_key);
    }

    await file.destroy();
  }

  /**
   * Update the sort_order of a file.
   * @param {number} addOnId
   * @param {number} fileId
   * @param {number} actorId
   * @param {number} sort_order
   * @returns {Promise<ServiceAddOnFile>}
   */
  async reorderFile(addOnId, fileId, actorId, sort_order) {
    const addOn = await this.assertAddOnExists(addOnId);
    await this.assertOwnerViaAddOn(addOn, actorId);

    const file = await ServiceAddOnFile.findOne({ where: { id: fileId, addOnId } });
    if (!file) {
      const err = new Error("File not found.");
      err.statusCode = 404;
      throw err;
    }

    if (!Number.isInteger(Number(sort_order)) || Number(sort_order) < 0) {
      const err = new Error("sort_order must be a non-negative integer.");
      err.statusCode = 400;
      throw err;
    }

    await file.update({ sort_order: Number(sort_order) });
    return file;
  }
}

module.exports = ServiceAddOnFileService;
