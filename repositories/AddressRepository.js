const Address = require("../models/address");
const sequelize = require('../config/database'); // Import Sequelize instance


class AddressRepository {
  async getCartByUserId(userId) {
    return await Address.findAll({ where: { userId } });
  }

  async addItemToCart(userId, productId, quantity) {
    return await Address.create({ userId, productId, quantity });
  }

  async removeItemFromCart(userId, productId) {
    return await Address.destroy({ where: { userId, productId } });
  }

  async addAddress(id, type, address) {
    return await Address.create({
      userId: id,
      type,
      ...address,
    });
  }

  async pinAddress(userId, addressId, type) {
    let transaction;
    try {
      console.log("Checking pinned address...");
  
      // Check if there is a currently pinned address for the user and type
      const hasPinnedAddress = await Address.findOne({
        where: { userId, type: type.toLowerCase(), pin: 1 },
      });
  
      if (hasPinnedAddress) {
  
        // If the already pinned address is the same as the one being pinned, unpin it
        if (hasPinnedAddress.id === addressId) {
          await Address.update(
            { pin: 0 },
            { where: { id: addressId, userId } }
          );
          return { success: true, message: "Address unpinned successfully." };
        }
  
        // If another address is already pinned, disallow pinning a new one
        return {
          success: false,
          message: "An address is already pinned. Update not allowed.",
        };
      }
  
      // Start a transaction
      transaction = await sequelize.transaction();
  
      // Unpin any previously pinned addresses for this user
      await Address.update(
        { pin: 0 },
        { where: { userId }, transaction }
      );
  
      // Pin the new address
      const [affectedRows] = await Address.update(
        { pin: 1 },
        { where: { id: addressId, userId }, transaction }
      );
  
      // Check if the row was updated successfully
      if (affectedRows === 0) {
        throw new Error("No address found to update.");
      }
  
      // Commit the transaction
      await transaction.commit();
      return { success: true, message: "Address pinned successfully!" };
  
    } catch (error) {
      if (transaction) await transaction.rollback(); // Rollback in case of error
      console.error("Error pinning address:", error.message || error);
      return { success: false, message: "Failed to pin address.", error: error.message || error };
    }
  }
  
}

module.exports = AddressRepository;
