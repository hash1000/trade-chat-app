const { Service, ServiceFile } = require("../models");

// Only the service owner, its assigned editor ("Edit" in Access & Team) or a
// platform admin may change a service's files. Runs before multer so files for
// someone else's service are refused before anything is uploaded.
function canEdit(service, user) {
  if (!service || !user) return false;
  if ((user.roles || []).some((r) => r.name === "admin")) return true;
  return service.userId === user.id || service.assigneeEditorId === user.id;
}

async function check(serviceId, req, res, next) {
  try {
    const service = await Service.findByPk(serviceId);
    if (!service) return res.status(404).json({ success: false, error: "Service not found." });
    if (!canEdit(service, req.user)) {
      return res.status(403).json({ success: false, error: "Only the service owner, its editor or an admin can change this service." });
    }
    return next();
  } catch (error) {
    console.error("serviceEditor middleware error:", error);
    return res.status(500).json({ success: false, error: "Server error. Please try again later." });
  }
}

/** For routes with :serviceId (or :id). */
const requireServiceEditor = (req, res, next) => check(Number(req.params.serviceId ?? req.params.id), req, res, next);

/** For DELETE /files/:fileId — finds the file's service first. */
const requireServiceFileEditor = async (req, res, next) => {
  try {
    const file = await ServiceFile.findByPk(Number(req.params.fileId));
    if (!file) return res.status(404).json({ success: false, error: "File not found." });
    return check(file.service_id, req, res, next);
  } catch (error) {
    console.error("serviceEditor middleware error:", error);
    return res.status(500).json({ success: false, error: "Server error. Please try again later." });
  }
};

module.exports = { requireServiceEditor, requireServiceFileEditor };
