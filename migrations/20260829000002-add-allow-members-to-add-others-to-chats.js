"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Group settings toggle: when true, any current member can call
    // POST /:id/members (not just the group admin) — see
    // ChatService.assertCanAddMembers.
    await queryInterface.addColumn("chats", "allowMembersToAddOthers", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("chats", "allowMembersToAddOthers");
  },
};
