const sequelize = require("../config/database");
const Address = require("../models/address");

class AddressRepository {
  async getaddressByUserId(userId) {
    return await Address.findAll({ where: { userId } });
  }

  async getPinaddressByUserId(userId) {
    return await Address.findOne({
      where: { userId, pin: 1 }
    });
  }

  async deleteAddress(id) {
    let data;
    const hasPinnedAddress = await Address.findOne({
      where: { id: id, pin: 1 },
    });
    if (!hasPinnedAddress) {
      data = await Address.destroy({
        where: { id },
      });
      return {
        message: "An address is deleted",
        data: data,
      };
    }
    return {
      message: "This address has pined",
      data: data,
    };
  }

  async getaddressByType(userId, type) {
    return await Address.findAll({
      where: { userId, type: type.toLowerCase() },
    });
  }

  async getAddressById(userId, addressId) {
    const address = await Address.findOne({
      where: { id: addressId, userId },
    });

    return address;
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

  async pinAddress(userId, addressId) {
    let transaction;
    try {
      // Check if there is a currently pinned address for the user
      const hasPinnedAddress = await Address.findOne({
        where: { id: addressId, userId: userId, pin: 1 }, // Ensure userId matches
      });

      if (hasPinnedAddress) {
        // If the already pinned address is the same as the one being pinned, return an error
        if (hasPinnedAddress.id === addressId) {
          console.log("condition true");
          return {
            success: false,
            message: "This address is already pinned.",
          };
        }
      }

      // Start a transaction
      transaction = await sequelize.transaction();

      // Unpin any previously pinned addresses for this user
      await Address.update(
        { pin: 0 },
        { where: { userId: userId }, transaction }
      );

      // Pin the new address
      const [affectedRows] = await Address.update(
        { pin: 1 },
        {
          where: { id: addressId, userId: userId },
          transaction,
        }
      );

      // Check if the row was updated successfully
      if (affectedRows === 0) {
        throw new Error(`No address found to update.`);
      }

      // Commit the transaction
      await transaction.commit();
      return { success: true, message: "Address pinned successfully!" };
    } catch (error) {
      if (transaction) await transaction.rollback(); // Rollback in case of error
      console.error("Error pinning address:", error.message || error);
      return {
        success: false,
        message: "Failed to pin address.",
        error: error.message || error,
      };
    }
  }

  async updateAddress(addressId, updateFields) {
    const [affectedRows] = await Address.update(updateFields, {
      where: { id: addressId },
    });

    if (affectedRows === 0) {
      throw new Error("No address found to update.");
    }

    // Fetch and return the updated address
    const updatedAddress = await Address.findOne({ where: { id: addressId } });
    return updatedAddress;
  }
}

module.exports = AddressRepository;
