const GameSession = require("../core/GameSession");
const config = require("../config");
const GameStateManager = require("../core/GameStateManager");

const setupSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    let gameSession;

    socket.on("joinGame", ({ gameId, playerId, playerName }) => {
      gameSession = new GameSession(socket, gameId, playerId, playerName);
      socket.join(gameId);

      GameStateManager.initializePlayerData(gameId, playerId);
      const game = GameStateManager.getGame(gameId);
      game.gameState = config.GAME_STATES.INITIALIZED;

      socket.emit("changeGameState", config.GAME_STATES.INITIALIZED);
      socket.emit("message", "Welcome to Battleship!");
      socket.broadcast.to(gameId).emit("message", `${playerName} has joined.`);

      if (game.players.length === 1) {
        socket.emit("message", "Waiting for opponent...");
      } else {
        game.isListed = false;
        game.gameState = config.GAME_STATES.SETTING_SHIPS;
        io.to(gameId).emit("changeGameState", config.GAME_STATES.SETTING_SHIPS);
        io.to(gameId).emit("message", "Game started! Place your ships!");
      }
    });

    socket.on("clickOnFriendlyGrid", (data) =>
      gameSession?.handleShipPlacement(data)
    );
    socket.on("clickOnEnemyGrid", (data) => gameSession?.handleAttack(data));
    socket.on("chatMessage", ({ playerName, message }) => {
      io.to(gameSession.gameId).emit("chatMessage", { playerName, message });
    });
    socket.on("disconnect", () => gameSession?.handleDisconnect());
  });
};

module.exports = setupSocketHandlers;
