// sequelize-cli config — reads the same .env MYSQL_* vars the app uses
// (config/database.js), so migrations always target whatever DB .env points
// to (production on the server, development locally). No secrets committed.
require("dotenv").config();

const base = {
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  dialect: "mysql",
};

module.exports = {
  development: base,
  production: base,
};
