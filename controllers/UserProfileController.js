const UserProfileService = require("../services/UserProfileService"); // Replace the path with the correct location of your UserService.js file

const userProfileService = new UserProfileService();

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
  
}

module.exports = UserProfileController;
