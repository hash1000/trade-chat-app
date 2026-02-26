const { User, Role } = require("../models");

class RoleRepository {
  async getByNames(roleNames, transaction = null) {
    return Role.findAll({
      where: { name: roleNames },
      transaction,
    });
  }

  async getAllRoles() {
    return Role.findAll({
      attributes: ["id", "name", "createdAt", "updatedAt"],
      order: [["name", "ASC"]],
    });
  }

  async getUserById(userId, transaction = null) {
    return User.findByPk(userId, {
      include: [
        {
          model: Role,
          as: "roles",
        },
      ],
      transaction,
    });
  }

  async getUsersByIds(userIds, transaction = null) {
    return User.findAll({
      where: { id: userIds },
      include: [
        {
          model: Role,
          as: "roles",
        },
      ],
      transaction,
    });
  }

  async setUserRoles(user, roles, transaction = null) {
    return user.setRoles(roles, { transaction });
  }

  async removeUserRole(user, role, transaction = null) {
    return user.removeRole(role, { transaction });
  }

  async getUsersByRole(roleName) {
    const users = await User.findAll({
      include: [
        {
          model: Role,
          as: "roles",
          where: { name: roleName },
          required: true,
        },
      ],
    });

    return users.map((user) => user.toJSON());
  }
}

module.exports = RoleRepository;
