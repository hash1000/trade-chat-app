const { Sequelize } = require('sequelize')
const fs = require('fs');

const sequelize = new Sequelize({
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  dialect: 'mysql',
  // No `logging` option here used to mean Sequelize's default:
  // `console.log` on EVERY query, unconditionally — including the
  // multi-join, 60+ column SELECTs behind the chat/message list endpoints
  // (see repositories/ChatRepository.js buildDetailIncludes). That's a
  // synchronous stdout write per query, on every API request AND every
  // socket event that touches the DB (typing/send message/mark seen all
  // do their own participant check + writes) — a constant, compounding
  // drag on throughput, worse the more concurrent traffic there is. Off
  // by default now; set SQL_DEBUG=true in .env to turn query logging back
  // on when actually debugging locally.
  logging: process.env.SQL_DEBUG === 'true' ? console.log : false,
  // Default pool is { max: 5, min: 0 } — 5 connections is easy to exhaust
  // once socket traffic (which shares this same Sequelize instance) is
  // competing with REST requests for the same pool; a request that can't
  // immediately acquire one just queues and waits (up to `acquire` below)
  // instead of failing fast — which shows up as exactly "this is taking a
  // long time" rather than a clear error. Override via MYSQL_POOL_MAX if
  // you run multiple app instances/processes sharing the same DB — check
  // MySQL's own max_connections first.
  pool: {
    max: Number(process.env.MYSQL_POOL_MAX) || 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
})

// Async function to handle database connection and default tags insertion
const initializeDatabase = async () => {
  try {
    console.log("database initializing...");
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
