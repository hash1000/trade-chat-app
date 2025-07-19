const express = require("express");
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const path = require("path");
const routes = require("./routes/index");
const cors = require("cors");
const { Server } = require("socket.io");


// ✅ Apply raw only for webhook
const app = express();
const httpServer = require('http').createServer(app);
const io = new Server(httpServer, {
  path: "/socket.io", // Base path for Socket.IO
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use('/api/payment/webhook', bodyParser.raw({ type: 'application/json' }));

// 👇 Initialize socket utils with io instance
const { initSocketUtils } = require("./utilities/socketUtils");
initSocketUtils(io);

// Initialize your upload socket
require('./socket/streamUploadSocket')(io);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "node_modules/socket.io/client-dist")));


// View engine
app.set("views", path.join(__dirname, "public/views"));
app.set("view engine", "ejs");

// Middleware
app.use(cors());
app.use(logger("dev"));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/api", routes);
app.get("/view", (req, res) => {
  res.render("index", {
    title: "Fast File Upload",
    heading: "Upload Your Files",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

// Export both app and httpServer
module.exports = { app, httpServer };