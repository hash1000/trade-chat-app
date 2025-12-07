const ShortListService = require("../services/ShortListService");
const shortListService = new ShortListService();

class ShortListController {

  // Create new shortlist item
  async createListItem(req, res) {
    try {
      const { id: userId } = req.user; // Assuming `userId` is available in `req.user`
      const { title, categoryId, description, adminNote, customerNote } = req.body;

      console.log("title, description, adminNote, customerNote", userId, title, description, adminNote, customerNote);

      // Call service to create shortlist item
      const item = await shortListService.createListItem(userId, { title, categoryId, description, adminNote, customerNote });

      return res.status(201).json({
        success: true,
        message: "Item added successfully",
        data: item,
      });
    } catch (error) {
      console.error("createListItem Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  // Get all shortlist items for a user
  async getListItems(req, res) {
    try {
      const { id: userId } = req.user; // Assuming `userId` is available in `req.user`
      const items = await shortListService.getListItems(userId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error("getListItems Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  // Get a single shortlist item by ID
  async getListItem(req, res) {
    try {
      const { id: userId } = req.user; // Assuming `userId` is available in `req.user`
      const { id } = req.params;

      // Get shortlist item for the logged-in user
      const item = await shortListService.getShortListItem(id);

      if (!item) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      console.error("getListItem Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  // Update shortlist item
  async updateListItem(req, res) {
    try {
      const { id: userId } = req.user;  // Assuming `userId` is available in `req.user`
      const { id } = req.params;
      const updateData = req.body;

      // Update shortlist item for the logged-in user
      const updated = await shortListService.updateListItem(userId, id, updateData);

      if (!updated) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        message: "List item updated",
        data: updated,
      });
    } catch (error) {
      console.error("updateListItem Error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Server Error",  // Send proper error message back
      });
    }
  }

  // Delete shortlist item
  async deleteListItem(req, res) {
    try {
      const { id: userId } = req.user;  // Assuming `userId` is available in `req.user`
      const { id } = req.params;

      // Delete shortlist item for the logged-in user
      const deleted = await shortListService.deleteListItem(userId, id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        message: "List item deleted",
      });
    } catch (error) {
      console.error("deleteListItem Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }
}

module.exports = ShortListController;
