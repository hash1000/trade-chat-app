// controllers/ListController.js
const ListService = require("../services/ListService");
const listService = new ListService();

class ListController {
  // ➤ Create a new list item
  async createListItem(req, res) {
    try {
      const { id: userId } = req.user;
      const { id: shortListId } = req.params;
      const { title, description, sequence } = req.body;

      // Create the list item
      const item = await listService.createListItem(shortListId, { title, description, sequence });

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

  // ➤ Reorder list items
  async reorderListItems(req, res) {
    try {
      const { id: userId } = req.user;
      const { id: shortListId } = req.params;
      const { orderedListIds } = req.body;  // Expected format: [1, 2, 3, ...]

      // Reorder list items
      const result = await listService.reorderListItems(shortListId, orderedListIds);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("reorderListItems Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  // ➤ Get all list items
  async getListItems(req, res) {
    try {
      const { id: userId } = req.user;
      const { id: shortListId } = req.params;

      const items = await listService.getListItems(shortListId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error("getListItems Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }


  
  // ➤ Get single list items
  async getSingleListItems(req, res) {
    try {
      const { listId } = req.params;

      const items = await listService.getSingleListItems(listId);

      return res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      console.error("getListItems Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

    async updateListItem(req, res) {
    try {
      const { listId, id } = req.params;
      const { title, description, sequence } = req.body;

      // Update the list item
      const updatedItem = await listService.updateListItem(listId, id, { title, description, sequence });

      if (!updatedItem) {
        return res.status(404).json({
          success: false,
          message: "Item not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Item updated successfully",
        data: updatedItem,
      });
    } catch (error) {
      console.error("updateListItem Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

   async deleteListItem(req, res) {
    try {
      const { id } = req.params;

      // Delete the list item
      const deleted = await listService.deleteListItem(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Item not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Item deleted successfully",
      });
    } catch (error) {
      console.error("deleteListItem Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

}

module.exports = ListController;
