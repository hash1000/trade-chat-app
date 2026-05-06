"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [trans] = await queryInterface.sequelize.query(`
      SELECT * FROM wallet_transactions
    `);

    const toUserE = [];
    const fromUser = [];
    trans.map((wallet) => {
      if (wallet.meta["toUser"]) {
        toUserE.push({ id: wallet.id, user: wallet.meta["toUser"] });
      } else if (wallet.meta["fromUser"]) {
        fromUser.push({ id: wallet.id, user: wallet.meta["fromUser"] });
      } else {
        console.log("Pass");
      }
    });

  for(const wallet of toUserE){

          await queryInterface.sequelize.query(
            `
            UPDATE wallet_transactions
            SET receiverId = :receiverId
            WHERE id = :id
            `,
            {
              replacements: {
                receiverId: Number(wallet.user),
                id: Number(wallet.id),
              },
          }
        );
        }

        for(const wallet of fromUser){

          await queryInterface.sequelize.query(
            `
            UPDATE wallet_transactions
            SET receiverId = :receiverId
            WHERE id = :id
            `,
            {
              replacements: {
                receiverId: Number(wallet.user),
                id: Number(wallet.id),
              },
          }
        );
        }
  },

  async down(queryInterface, Sequelize) {},
};
