const { Sequelize } = require('sequelize')
const fs = require('fs');

const sequelize = new Sequelize({
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  // ssl: true,
  dialect: 'mysql',
  // dialectOptions: {
  //   ssl: {
  //     minVersion: 'TLSv1',
  //     ca: fs.readFileSync("../resources/ca-certificate.crt", "utf8")
  //   }
  // }
})

// Async function to handle database connection and default tags insertion
const initializeDatabase = async () => {
  try {
    // Authenticate the database connection
    await sequelize.authenticate();
    console.log('Connection to the database has been established successfully.');
    
  } catch (error) {
    console.error('Error occurred:', error);
  }
};

// Call the initialization function
initializeDatabase();
  

module.exports = sequelize
