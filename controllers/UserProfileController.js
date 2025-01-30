const UserProfileService = require('../services/UserProfileService'); // Replace the path with the correct location of your UserService.js file
const AddressService = require("../services/AddressService");

const userProfileService = new UserProfileService();


const addressService = new AddressService();

class UserProfileController {
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const { dataValues } = req.user;
      if (!userId) {
        return res.status(404).json({ message: "User not found" });
      }
      const user = await userProfileService.getUserProfileById(
        userId,
        dataValues.id
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async createLike(req, res) {
    try {
      //  create or update the reaction
      const { userId: profileId, status } = req.params;
      const userId = req.user.id;
      if (status === "add") {
        await userProfileService.createOrUpdateReaction(
          userId,
          profileId,
          "like"
        );
      } else {
        await userProfileService.removeReaction(userId, profileId, "like");
      }
      const user = await userProfileService.getUserProfileById(
        profileId,
        req.user.id
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async createDislike(req, res) {
    try {
      //  create or update the reaction
      const { userId: profileId, status } = req.params;
      const userId = req.user.id;
      if (status === "add") {
        await userProfileService.createOrUpdateReaction(
          userId,
          profileId,
          "dislike"
        );
      } else {
        await userProfileService.removeReaction(userId, profileId, "dislike");
      }
      const user = await userProfileService.getUserProfileById(
        profileId,
        req.user.id
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
  async createFavourite(req, res) {
    try {

      const { userId: profileId, status } = req.params;
      const userId = req.user.id;
      if (status === "add") {
        await userProfileService.createFavourite(userId, profileId);
      } else {
        await userProfileService.removeFavourite(userId, profileId);
      }
      const user = await userProfileService.getUserProfileById(
        profileId,
        req.user.id
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async createFriendship(req, res) {
    try {
      //  create user friendship
      const { userId: profileId, status } = req.params;
      const userId = req.user.id;
      if (status === "add") {
        await userProfileService.createFriendship(userId, profileId);
      } else {
        await userProfileService.removeFriendship(userId, profileId);
      }
      const user = await userProfileService.getUserProfileById(
        profileId,
        req.user.id
      );
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async getContacts(req, res) {
    const userId = req.user.id;
    const { page = 1, pageSize = 10 } = req.body;
    try {
      const data = await userProfileService.getUserContacts(
        userId,
        page,
        pageSize
      );
      res.json({ data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  async getAllUsers(req, res) {
    try {
      const users = await userProfileService.getAllUsersProfile();
      return res.json({ user: users });
    } catch (error) {
      console.error("Error during getting users profile:", error);
      res.status(500).json({ message: "Login getting users" });
    }
  }

  async getUserTags(req, res) {
    try {
      const user = req.user; // Extract user from request
      const tags = await userProfileService.getUserTags(user);

      return res.status(200).json({
        message: "Updated user tag list with friend tags",
        userTags: tags,
      });
    } catch (error) {
      console.error("Error during fetching tags:", error);
      res.status(500).json({ message: "Error while getting user tags" });
    }
  }
  async deleteAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const address = await addressService.deleteAddress(id);

      return res.status(200).json({
        message: "Delete data",
        userTags: address,
      });
    } catch (error) {
      console.error("Error during Delete data:", error);
      res.status(500).json({ message: "Error while Delete data" });
    }
  }
  async getAddressById(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { addressId } = req.params; // Address ID to retrieve

      // Fetch the address
      const address = await addressService.getAddressById(user.id, addressId);

      return res.status(200).json({
        message: "Address retrieved successfully.",
        address,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
  async getaddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { type } = req.query;

      let address;
      if (type) {
        address = await addressService.getaddressByType(user.id, type);
      } else {
        address = await addressService.getaddressByUserId(user.id);
      }

      return res.status(200).json({
        message: "User addresses",
        address,
      });
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Error while getting user addresses" });
    }
  }

  async addAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const addressDetails = req.body;
      if (!addressDetails || Object.keys(addressDetails).length === 0) {
        return res.status(400).json({ error: "Address details are required." });
      }

      const address = await addressService.addAddress(user, addressDetails);

      return res.status(200).json({
        message: "Address added successfully.",
        address,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async updatePinAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { addressId, type } = req.body;
      const address = await addressService.updatePinAddress(user.id, addressId, type);

      return res.status(200).json({
        address
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
  async updateAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { addressId } = req.params; // Address ID to update
      const { pin, type, ...updateFields } = req.body; 
      if (!updateFields || Object.keys(updateFields).length === 0) {
        return res.status(400).json({ error: "No fields provided for update." });
      }

      // Update the address
      const updatedAddress = await addressService.updateAddress(user.id, addressId, updateFields);

      return res.status(200).json({
        message: "Address updated successfully.",
        address: updatedAddress,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  async deleteAddress(req, res) {
    try {
      const user = req.user; // Extract user from request
      const { addressId } = req.params; // Address ID to delete

      // Delete the address
      const deleteAddress = await addressService.deleteAddress(user.id, addressId);

      return res.status(200).json({
        address :deleteAddress
        
      });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = UserProfileController;
