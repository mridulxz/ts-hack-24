const path = require("path");
const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

router.get("/games", gameController.getGames);
router.post("/games", gameController.createGame);
router.get("/games/join", gameController.joinGame);
router.get("/play", (req, res) => {
  res.sendFile(path.join(__dirname, "../../../client/public/play.html"));
});

module.exports = router;
