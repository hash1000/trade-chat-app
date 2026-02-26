const sequelize = require("../config/database");
const CustomError = require("../errors/CustomError");
const RoleRepository = require("../repositories/RoleRepository");

const roleRepository = new RoleRepository();

class RoleService {
  normalizeRoles(roleNames) {
    return [
      ...new Set(
        roleNames.map((role) => String(role).trim().toLowerCase()).filter(Boolean)
      ),
    ];
  }

  async updateUserRoles(requesteeId, roleNames) {
    const normalizedRoles = this.normalizeRoles(roleNames);

    if (!normalizedRoles.length) {
      throw new CustomError("roles must be a non-empty array", 422);
    }

    const requesteeUser = await roleRepository.getUserById(requesteeId);
    if (!requesteeUser) {
      throw new CustomError("User not found", 404);
    }

    const roles = await roleRepository.getByNames(normalizedRoles);
    const foundRoleNames = new Set(roles.map((role) => role.name));
    const invalidRoles = normalizedRoles.filter((role) => !foundRoleNames.has(role));

    if (invalidRoles.length) {
      throw new CustomError(`Invalid roles: ${invalidRoles.join(", ")}`, 400);
    }

    const transaction = await sequelize.transaction();
    try {
      await roleRepository.setUserRoles(requesteeUser, roles, transaction);
      const updatedUser = await roleRepository.getUserById(requesteeId, transaction);
      await transaction.commit();

      return { message: "Roles updated successfully", user: updatedUser };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getUsersByRole(roleName) {
    const normalizedRole = String(roleName).trim().toLowerCase();
    const existingRole = await roleRepository.getByNames([normalizedRole]);

    if (!existingRole.length) {
      throw new CustomError("Role not found", 400);
    }

    const users = await roleRepository.getUsersByRole(normalizedRole);
    return { role: normalizedRole, users };
  }

  async getAllRoles() {
    return roleRepository.getAllRoles();
  }

  async bulkUpdateUserRoles(userIds, roleNames) {
    const normalizedUserIds = [...new Set(userIds.map((id) => Number(id)))];
    const normalizedRoles = this.normalizeRoles(roleNames);

    if (!normalizedRoles.length) {
      throw new CustomError("roles must be a non-empty array", 422);
    }

    const roles = await roleRepository.getByNames(normalizedRoles);
    const foundRoleNames = new Set(roles.map((role) => role.name));
    const invalidRoles = normalizedRoles.filter((role) => !foundRoleNames.has(role));

    if (invalidRoles.length) {
      throw new CustomError(`Invalid roles: ${invalidRoles.join(", ")}`, 400);
    }

    const users = await roleRepository.getUsersByIds(normalizedUserIds);
    const foundUserIds = new Set(users.map((user) => user.id));
    const missingUserIds = normalizedUserIds.filter((id) => !foundUserIds.has(id));

    if (missingUserIds.length) {
      throw new CustomError(
        `Users not found: ${missingUserIds.join(", ")}`,
        404
      );
    }

    const transaction = await sequelize.transaction();
    try {
      for (const user of users) {
        await roleRepository.setUserRoles(user, roles, transaction);
      }

      const updatedUsers = await roleRepository.getUsersByIds(
        normalizedUserIds,
        transaction
      );

      await transaction.commit();

      return {
        message: "Roles updated successfully for all users",
        users: updatedUsers,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async removeUserRole(userId, roleName) {
    const normalizedRole = String(roleName).trim().toLowerCase();
    const user = await roleRepository.getUserById(userId);

    if (!user) {
      throw new CustomError("User not found", 404);
    }

    const roles = await roleRepository.getByNames([normalizedRole]);
    const role = roles[0];

    if (!role) {
      throw new CustomError("Role not found", 400);
    }

    const hasRole = user.roles.some((existingRole) => existingRole.id === role.id);
    if (!hasRole) {
      throw new CustomError("User does not have this role", 400);
    }

    const transaction = await sequelize.transaction();
    try {
      await roleRepository.removeUserRole(user, role, transaction);
      const updatedUser = await roleRepository.getUserById(userId, transaction);
      await transaction.commit();

      return {
        message: "Role removed successfully",
        user: updatedUser,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = RoleService;
