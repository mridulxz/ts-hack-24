const path = require("path");
const Game = require("../../models/Game");
const Player = require("../../models/Player");
const GameStateManager = require("../../core/GameStateManager");
const { generateUUID } = require("../../utils/gameUtils");

const getGames = (req, res) => {
  const availableGames = GameStateManager.getAvailableGames();
  res.status(200).json(availableGames);
};

const createGame = (req, res) => {
  const { playerName, playerId } = req.body;

  if (!playerName || !playerId) {
    return res.status(400).json({
      message: "Bad request! Please submit correct data!",
    });
  }

  const player = new Player(playerId, playerName);
  const gameId = generateUUID();
  const game = new Game(gameId, `${playerName}'s Game`, [player]);

  GameStateManager.createGame(gameId, game);

  res.redirect(
    `/play?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
  );
};

const joinGame = (req, res) => {
  const { playerName, playerId, game: gameId } = req.query;

  if (!playerName || !gameId || !playerId) {
    return res.redirect("/");
  }

  const game = GameStateManager.getGame(gameId);
  if (!game || game.isGameFull() || game.isGameEmpty()) {
    return res.redirect("/");
  }

  game.players.push(new Player(playerId, playerName));
  res.redirect(
    `/play?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
  );
};

module.exports = {
  getGames,
  createGame,
  joinGame,
};
