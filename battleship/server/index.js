import express from "express";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import gameRoutes from "./api/routes/gameRoutes.js";
import config from "./config.js";
import setupSocketHandlers from "./socket/gameSocketHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/public")));
app.use("/src", express.static(path.join(__dirname, "../client/src")));

// Routes
app.use("/", gameRoutes);

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

// Initialize Socket.IO
const io = new Server(server);
setupSocketHandlers(io);

export default app;