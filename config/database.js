const { Sequelize } = require('sequelize')
const fs = require('fs')

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
sequelize.authenticate()
  .then(() => {
    console.log('Connection to the database has been established successfully.')
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err)
  })

module.exports = sequelize
