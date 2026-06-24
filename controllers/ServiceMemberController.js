const ServiceMemberService = require("../services/ServiceMemberService");

const serviceMemberService = new ServiceMemberService();

class ServiceMemberController {
  /**
   * GET /services/:serviceId/members
   * Paginated list of team members with user details.
   */
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
   * POST /services/:serviceId/members
   * Add a user as a service team member. Only service owner can add.
   */
  async addMember(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { userId } = req.body;

      if (!userId || !Number.isInteger(Number(userId))) {
        return res.status(400).json({ success: false, error: "userId must be a valid integer." });
      }

      const member = await serviceMemberService.addMember(serviceId, actorId, Number(userId));

      return res.status(201).json({ success: true, data: member });
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.addMember");
    }
  }

  /**
   * DELETE /services/:serviceId/members/:userId
   * Remove a team member. Only service owner can remove.
   */
  async removeMember(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const userId = Number(req.params.userId);

      await serviceMemberService.removeMember(serviceId, actorId, userId);

      return res.status(204).send();
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

      await serviceMemberService.clearAssignee(serviceId, actorId);

      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "ServiceMemberController.clearAssignee");
    }
  }
}

/**
 * Centralised error handler — maps statusCode from service layer to HTTP response.
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

module.exports = ServiceMemberController;
