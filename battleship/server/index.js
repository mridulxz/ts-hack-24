const path = require("path");
const express = require("express");
const socketio = require("socket.io");
const gameRoutes = require("./api/routes/gameRoutes");
const setupSocketHandlers = require("./socket/gameSocketHandler");
const config = require("./config");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/public")));
app.use("/src", express.static(path.join(__dirname, "../client/src")));  // Add this line to serve src directory

// Routes
app.use("/", gameRoutes);

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

// Initialize Socket.IO
const io = socketio(server);
setupSocketHandlers(io);