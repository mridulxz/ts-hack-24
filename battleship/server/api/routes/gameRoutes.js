const path = require("path");
const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

// Routes for pages
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../client/public/index.html"));
});

router.get("/create", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../client/public/create.html"));
});

router.get("/join", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../client/public/join.html"));
});

router.get("/play", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../client/public/play.html"));
});

router.get("/games", gameController.getGames);
router.post("/games", gameController.createGame);
router.get("/games/join", gameController.joinGame);

module.exports = router;
