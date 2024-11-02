const path = require("path");
const express = require("express");
const socketio = require("socket.io");
const Game = require("./models/Game");
const Player = require("./models/Player");

// Constants and Configuration
const PORT = process.env.PORT || 5007;
const GRID_SIZE = 10;
const LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

const GAME_STATES = {
  INITIALIZING: "gameIsInitializing",
  INITIALIZED: "gameInitialized",
  SETTING_SHIPS: "setShipsRound",
  RUNNING: "gameRunning",
  OVER: "gameOver",
};

const SHIPS = {
  carrier: { size: 5, count: 1 },
  battleship: { size: 4, count: 1 },
  cruiser: { size: 3, count: 1 },
  destroyer: { size: 2, count: 1 },
  submarine: { size: 1, count: 1 },
};

const TOTAL_SHIP_CELLS = Object.values(SHIPS).reduce(
  (sum, ship) => sum + ship.size * ship.count,
  0
);

// Game state storage
const games = {};

// Utility functions
const generateUUID = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

const createEmptyGrid = (size = GRID_SIZE) =>
  Array(size)
    .fill()
    .map(() => Array(size).fill(0));

const isValidCoordinate = (x, y) =>
  x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;

// Express setup
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "www")));

// Game management routes
app.get("/games", (req, res) => {
  const availableGames = Object.values(games).filter(
    (game) => !game.isGameFull() && game.isListed
  );
  res.status(200).json(availableGames);
});

app.post("/games", (req, res) => {
  const { playerName, playerId } = req.body;

  if (!playerName || !playerId) {
    return res.status(400).json({
      message: "Bad request! Please submit correct data!",
    });
  }

  const player = new Player(playerId, playerName);
  const gameId = generateUUID();
  const game = new Game(gameId, `${playerName}'s Game`, [player]);
  games[gameId] = game;

  res.redirect(
    `/play.html?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
  );
});

app.get("/games/join", (req, res) => {
  const { playerName, playerId, game: gameId } = req.query;

  if (!playerName || !gameId || !playerId) {
    return res.redirect("/");
  }

  const game = games[gameId];
  if (!game || game.isGameFull() || game.isGameEmpty()) {
    return res.redirect("/");
  }

  game.players.push(new Player(playerId, playerName));
  res.redirect(
    `/play.html?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
  );
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Socket.IO game logic
const io = socketio(server);

class GameSession {
  constructor(socket, gameId, playerId, playerName) {
    this.socket = socket;
    this.gameId = gameId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.game = games[gameId];
    this.otherPlayerGrid = createEmptyGrid();
  }

  initializePlayerData() {
    this.game[`${this.playerId}_grid`] = createEmptyGrid();
    this.game[`${this.playerId}_shipsPlaced`] = 0;
    this.game[`${this.playerId}_shipCellsPlaced`] = 0;
    this.game[`${this.playerId}_shipsLost`] = 0;
    this.game[`${this.playerId}_placedShips`] = Object.keys(SHIPS).reduce(
      (acc, ship) => ({ ...acc, [ship]: false }),
      {}
    );
  }

  getOtherPlayerId() {
    return this.game.players.find((player) => player.id !== this.playerId).id;
  }

  handleShipPlacement({ x, y, shipType, isVertical }) {
    if (this.game.gameState !== GAME_STATES.SETTING_SHIPS) return;
    if (
      !SHIPS[shipType] ||
      this.game[`${this.playerId}_placedShips`][shipType]
    ) {
      this.socket.emit(
        "message",
        `Invalid ship selection or ship already placed`
      );
      return;
    }

    const size = SHIPS[shipType].size;
    y = LETTERS.indexOf(y);

    // Validate placement
    if (!this.isValidShipPlacement(x, y, size, isVertical)) {
      this.socket.emit(
        "message",
        "Invalid ship placement! Try another position."
      );
      return;
    }

    // Place ship
    this.placeShip(x, y, size, isVertical);
    this.game[`${this.playerId}_placedShips`][shipType] = true;
    this.game[`${this.playerId}_shipCellsPlaced`] += size;
    this.game[`${this.playerId}_shipsPlaced`]++;

    this.socket.emit("shipPlaced", { shipType });
    this.socket.emit("updateGrid", {
      gridToUpdate: "friendlyGrid",
      data: this.game[`${this.playerId}_grid`],
    });

    this.checkAllShipsPlaced();
  }

  isValidShipPlacement(x, y, size, isVertical) {
    const grid = this.game[`${this.playerId}_grid`];

    for (let i = 0; i < size; i++) {
      const checkX = isVertical ? x : x + i;
      const checkY = isVertical ? y + i : y;

      if (!isValidCoordinate(checkX, checkY) || grid[checkY][checkX] === 1) {
        return false;
      }
    }
    return true;
  }

  placeShip(x, y, size, isVertical) {
    const grid = this.game[`${this.playerId}_grid`];
    for (let i = 0; i < size; i++) {
      if (isVertical) {
        grid[y + i][x] = 1;
      } else {
        grid[y][x + i] = 1;
      }
    }
  }

  checkAllShipsPlaced() {
    const allShipsPlaced = Object.keys(SHIPS).length;
    const player1Ships = this.game[`${this.game.players[0].id}_shipsPlaced`];
    const player2Ships = this.game[`${this.game.players[1].id}_shipsPlaced`];

    if (player1Ships === allShipsPlaced && player2Ships === allShipsPlaced) {
      this.game.gameState = GAME_STATES.RUNNING;
      io.to(this.gameId).emit("changeGameState", GAME_STATES.RUNNING);
      io.to(this.gameId).emit("message", "All ships placed! Battle begins!");
      io.to(this.gameId).emit("nextRound");

      this.socket.emit("yourTurn", false);
      this.socket.broadcast.to(this.gameId).emit("yourTurn", true);
    }
  }

  handleAttack({ x, y }) {
    if (this.game.gameState !== GAME_STATES.RUNNING) return;

    const otherPlayerId = this.getOtherPlayerId();
    y = LETTERS.indexOf(y);

    const targetCell = this.game[`${otherPlayerId}_grid`][y][x];

    if (targetCell === 2 || targetCell === 3) {
      this.socket.emit("message", "You already hit that spot!");
      return;
    }

    const hit = targetCell === 1;
    this.game[`${otherPlayerId}_grid`][y][x] = hit ? 3 : 2;
    this.otherPlayerGrid[y][x] = hit ? 3 : 2;

    if (hit) {
      this.game[`${otherPlayerId}_shipsLost`]++;
      this.handleHit(otherPlayerId);
    } else {
      this.socket.emit("message", "You hit water!");
      this.socket.broadcast.to(this.gameId).emit("message", "Enemy missed!");
    }

    this.updateGrids();
    this.nextTurn();
  }

  handleHit(otherPlayerId) {
    if (this.game[`${otherPlayerId}_shipsLost`] >= TOTAL_SHIP_CELLS) {
      this.handleGameOver();
      return;
    }

    this.socket.emit("message", "Direct hit!");
    this.socket.broadcast.to(this.gameId).emit("message", "Your ship was hit!");
  }

  handleGameOver() {
    this.game.gameState = GAME_STATES.OVER;
    io.to(this.gameId).emit("changeGameState", GAME_STATES.OVER);
    this.socket.emit("message", "Victory! All enemy ships destroyed!");
    this.socket.broadcast
      .to(this.gameId)
      .emit("message", "Defeat! All ships lost!");
    io.to(this.gameId).emit(
      "message",
      `${this.playerName} wins! Returning to menu in 10 seconds...`
    );
  }

  updateGrids() {
    this.socket.emit("updateGrid", {
      gridToUpdate: "enemyGrid",
      data: this.otherPlayerGrid,
    });
    this.socket.broadcast.to(this.gameId).emit("updateGrid", {
      gridToUpdate: "friendlyGrid",
      data: this.game[`${this.getOtherPlayerId()}_grid`],
    });
  }

  nextTurn() {
    io.to(this.gameId).emit("nextRound");
    this.socket.emit("yourTurn", false);
    this.socket.broadcast.to(this.gameId).emit("yourTurn", true);
  }

  handleDisconnect() {
    io.to(this.gameId).emit("message", `${this.playerName} has left the game.`);

    this.game.players = this.game.players.filter(
      (player) => player.id !== this.playerId
    );
    this.game.gameState = GAME_STATES.OVER;

    io.to(this.gameId).emit("changeGameState", GAME_STATES.OVER);
    io.to(this.gameId).emit(
      "message",
      "Game over - opponent disconnected! Returning to menu in 10 seconds..."
    );

    if (this.game.players.length === 0) {
      delete games[this.gameId];
    }
  }
}

io.on("connection", (socket) => {
  let gameSession;

  socket.on("joinGame", ({ gameId, playerId, playerName }) => {
    gameSession = new GameSession(socket, gameId, playerId, playerName);
    socket.join(gameId);

    gameSession.initializePlayerData();
    gameSession.game.gameState = GAME_STATES.INITIALIZED;

    socket.emit("changeGameState", GAME_STATES.INITIALIZED);
    socket.emit("message", "Welcome to Battleship!");
    socket.broadcast.to(gameId).emit("message", `${playerName} has joined.`);

    if (gameSession.game.players.length === 1) {
      socket.emit("message", "Waiting for opponent...");
    } else {
      gameSession.game.isListed = false;
      gameSession.game.gameState = GAME_STATES.SETTING_SHIPS;
      io.to(gameId).emit("changeGameState", GAME_STATES.SETTING_SHIPS);
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
