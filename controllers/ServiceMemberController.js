const ServiceMemberService = require("../services/ServiceMemberService");

const serviceMemberService = new ServiceMemberService();

class ServiceMemberController {
  async listMembers(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

      const result = await serviceMemberService.getMembers(serviceId, { page, limit });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.listMembers");
    }
  }

  /**
   * POST /service/:serviceId/members
   * Body: { userIds: [21, 32] }
   */
  async addMember(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, error: "userIds must be a non-empty array of integers." });
      }
      if (userIds.some((id) => !Number.isInteger(Number(id)))) {
        return res.status(400).json({ success: false, error: "All userIds must be valid integers." });
      }

      const result = await serviceMemberService.addMembers(serviceId, actorId, userIds.map(Number));

      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.addMember");
    }
  }

  /**
   * DELETE /service/:serviceId/members
   * Body: { userIds: [21, 32] }
   */
  async removeMember(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, error: "userIds must be a non-empty array of integers." });
      }
      if (userIds.some((id) => !Number.isInteger(Number(id)))) {
        return res.status(400).json({ success: false, error: "All userIds must be valid integers." });
      }

      const result = await serviceMemberService.removeMembers(serviceId, actorId, userIds.map(Number));

      return res.status(200).json({
        success: true,
        message: `${result.removedUserIds.length} member(s) removed successfully.`,
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.removeMember");
    }
  }

  /**
   * PATCH /services/:serviceId/assignee
   * Set the assignee editor. Must be an existing service member.
   */
  async setAssignee(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { assigneeEditorId } = req.body;

      if (!assigneeEditorId || !Number.isInteger(Number(assigneeEditorId))) {
        return res.status(400).json({ success: false, error: "assigneeEditorId must be a valid integer." });
      }

      const service = await serviceMemberService.setAssignee(serviceId, actorId, Number(assigneeEditorId));

      return res.status(200).json({ success: true, data: service });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.setAssignee");
    }
  }

  /**
   * DELETE /services/:serviceId/assignee
   * Clear the assignee editor.
   */
  async clearAssignee(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;

      const result = await serviceMemberService.clearAssignee(serviceId, actorId);

      return res.status(200).json({
        success: true,
        message: "Assignee editor cleared successfully.",
        data: result,
      });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.clearAssignee");
    }
  }
}

function handleError(res, error, context) {
  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = ServiceMemberController;
