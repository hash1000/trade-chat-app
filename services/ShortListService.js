// services/ShortListService.js
const ShortListRepository = require("../repositories/ShortListRepository");
const shortListRepository = new ShortListRepository();

class ShortListService {

  // Create a shortlist item
  async createListItem(userId, data) {
    // Add userId to the data before saving it to the repository
    return await shortListRepository.create(userId, data);
  }

  // Get all shortlist items for a user
  async getListItems(userId) {
    return await shortListRepository.findAll(userId);
  }

  // Get a single shortlist item by ID for a user
  async getListItem(userId, id) {
    return await shortListRepository.findOne(userId, id);
  }

  // Update a shortlist item
  async updateListItem(userId, id, updateData) {
    // Ensure that the item belongs to the user before updating
    const item = await shortListRepository.findOne(userId, id);
    if (!item) return null;
    
    return await shortListRepository.update(userId, id, updateData);
  }

  // Delete a shortlist item
  async deleteListItem(userId, id) {
    // Ensure that the item belongs to the user before deleting
    const item = await shortListRepository.findOne(userId, id);
    if (!item) return null;

    return await shortListRepository.delete(userId, id);
  }
}

module.exports = ShortListService;
