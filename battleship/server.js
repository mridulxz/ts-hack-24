const path = require("path");
const express = require("express");
const socketio = require("socket.io");
const Game = require("./models/Game");
const Player = require("./models/Player");

// Configuration constants
const CONFIG = {
  PORT: process.env.PORT || 5007,
  SHIPS: {
    carrier: { size: 5, count: 1 },
    battleship: { size: 4, count: 1 },
    cruiser: { size: 3, count: 1 },
    destroyer: { size: 2, count: 1 },
    submarine: { size: 1, count: 1 },
  },
  LETTERS: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
  GAME_STATES: {
    INITIALIZING: "gameIsInitializing",
    INITIALIZED: "gameInitialized",
    SETTING_SHIPS: "setShipsRound",
    RUNNING: "gameRunning",
    OVER: "gameOver",
  },
};

// Calculate total ship cells for victory condition
const TOTAL_SHIP_CELLS = Object.values(CONFIG.SHIPS).reduce(
  (sum, ship) => sum + ship.size * ship.count,
  0
);

const getInitialGridData = (width = 10, height = 10, initialCellValue = 0) => {
  const gridArray = [];

  for (let i = 0; i < height; i++) {
    gridArray.push(new Array(width).fill(initialCellValue));
  }

  return gridArray;
};

const generateUUID = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

class GameServer {
  constructor() {
    this.games = {};
    this.app = express();
    this.setupExpress();
    this.setupRoutes();
    this.server = this.app.listen(CONFIG.PORT, () => {
      console.log(`Server running on port ${CONFIG.PORT}`);
    });
    this.io = socketio(this.server);
    this.setupSocketHandlers();
  }

  setupExpress() {
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(express.json());
    this.app.use(express.static(path.resolve(__dirname, "www")));
  }

  setupRoutes() {
    // Get available games
    this.app.get("/games", (req, res) => {
      try {
        const availableGames = Object.values(this.games).filter(
          (game) => !game.isGameFull() && game.isListed
        );
        res.status(200).json(availableGames);
      } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Join existing game
    this.app.get("/games/join", (req, res) => {
      try {
        const { playerName, playerId, game: gameId } = req.query;

        if (!playerName || !gameId || !playerId) {
          return res.status(400).redirect("/");
        }

        const game = this.games[gameId];
        if (!game) {
          return res.status(404).redirect("/");
        }

        if (game.isGameFull()) {
          return res.status(409).redirect("/");
        }

        if (game.isGameEmpty()) {
          delete this.games[gameId];
          return res.status(404).redirect("/");
        }

        const player = new Player(playerId, playerName);
        game.players.push(player);

        res.redirect(
          `/play.html?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
        );
      } catch (error) {
        console.error("Error joining game:", error);
        res.status(500).redirect("/");
      }
    });

    // Create new game
    this.app.post("/games", (req, res) => {
      try {
        const { playerName, playerId } = req.body;

        if (!playerName || !playerId) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        const player = new Player(playerId, playerName);
        const gameId = generateUUID();
        const game = new Game(gameId, `${playerName}'s Game`, [player]);

        this.games[gameId] = game;

        res
          .status(301)
          .redirect(
            `/play.html?playerName=${playerName}&game=${gameId}&playerId=${playerId}`
          );
      } catch (error) {
        console.error("Error creating game:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }

  initializePlayerState(game, playerId) {
    game[`${playerId}_grid`] = getInitialGridData();
    game[`${playerId}_shipsPlaced`] = 0;
    game[`${playerId}_shipCellsPlaced`] = 0;
    game[`${playerId}_shipsLost`] = 0;
    game[`${playerId}_shipHits`] = Object.fromEntries(
      Object.keys(CONFIG.SHIPS).map((ship) => [ship, 0])
    );
    game[`${playerId}_placedShips`] = Object.fromEntries(
      Object.keys(CONFIG.SHIPS).map((ship) => [ship, false])
    );
  }

  handleShipPlacement(socket, game, playerId, x, y, shipType, isVertical) {
    if (!CONFIG.SHIPS[shipType]) {
      socket.emit("message", "Invalid ship type selected!");
      return false;
    }

    if (game[`${playerId}_placedShips`][shipType]) {
      socket.emit("message", `You've already placed your ${shipType}!`);
      return false;
    }

    const size = CONFIG.SHIPS[shipType].size;
    const grid = game[`${playerId}_grid`];

    // Validate placement
    if (isVertical && y + size > 10) {
      socket.emit(
        "message",
        "Ship would go out of bounds! Try another position."
      );
      return false;
    }

    if (!isVertical && x + size > 10) {
      socket.emit(
        "message",
        "Ship would go out of bounds! Try another position."
      );
      return false;
    }

    // Check for overlapping ships
    for (let i = 0; i < size; i++) {
      const checkY = isVertical ? y + i : y;
      const checkX = isVertical ? x : x + i;
      if (grid[checkY][checkX] === 1) {
        socket.emit(
          "message",
          "Invalid placement! Ship would overlap with another ship."
        );
        return false;
      }
    }

    // Place the ship
    for (let i = 0; i < size; i++) {
      const placeY = isVertical ? y + i : y;
      const placeX = isVertical ? x : x + i;
      grid[placeY][placeX] = 1;
    }

    game[`${playerId}_shipCellsPlaced`] += size;
    game[`${playerId}_shipsPlaced`]++;
    game[`${playerId}_placedShips`][shipType] = true;

    return true;
  }

  handleAttack(socket, game, attackerId, targetId, x, y) {
    const targetGrid = game[`${targetId}_grid`];
    const currentCell = targetGrid[y][x];

    // Check if cell was already hit
    if (currentCell === 2 || currentCell === 3) {
      socket.emit("message", "You already hit that spot! Try another one.");
      return false;
    }

    if (currentCell === 0) {
      // Miss
      targetGrid[y][x] = 2;
      socket.emit("message", "You hit water!");
      socket.broadcast.to(game.id).emit("message", "The enemy missed!");
    } else if (currentCell === 1) {
      // Hit
      targetGrid[y][x] = 3;
      game[`${targetId}_shipsLost`]++;
      socket.emit("message", "Direct hit on enemy ship!");
      socket.broadcast.to(game.id).emit("message", "Your ship was hit!");

      // Check for game over
      if (game[`${targetId}_shipsLost`] >= TOTAL_SHIP_CELLS) {
        game.gameState = CONFIG.GAME_STATES.OVER;
        this.io.to(game.id).emit("changeGameState", game.gameState);
        socket.emit("message", "Victory! You've destroyed all enemy ships!");
        socket.broadcast
          .to(game.id)
          .emit("message", "Defeat! All your ships are destroyed!");
        return true;
      }
    }

    return true;
  }

  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      const state = {
        gameId: null,
        playerId: null,
        playerName: "",
        otherPlayerGrid: getInitialGridData(),
      };

      socket.on("joinGame", ({ gameId, playerId, playerName }) => {
        state.gameId = gameId;
        state.playerName = playerName;
        state.playerId = playerId;

        socket.join(gameId);
        const game = this.games[gameId];

        this.initializePlayerState(game, playerId);

        if (game.players.length === 1) {
          socket.emit("message", "Waiting for opponent to join...");
        } else if (game.players.length === 2) {
          game.isListed = false;
          game.gameState = CONFIG.GAME_STATES.SETTING_SHIPS;
          this.io.to(gameId).emit("changeGameState", game.gameState);
          this.io.to(gameId).emit("message", "Game started! Place your ships!");
        }
      });

      socket.on("clickOnFriendlyGrid", ({ x, y, shipType, isVertical }) => {
        const game = this.games[state.gameId];
        if (game.gameState === CONFIG.GAME_STATES.SETTING_SHIPS) {
          y = CONFIG.LETTERS.indexOf(y);
          if (
            this.handleShipPlacement(
              socket,
              game,
              state.playerId,
              x,
              y,
              shipType,
              isVertical
            )
          ) {
            socket.emit("shipPlaced", { shipType });
            socket.emit("updateGrid", {
              gridToUpdate: "friendlyGrid",
              data: game[`${state.playerId}_grid`],
            });

            // Check if all ships are placed
            const allShipsPlaced = game.players.every(
              (player) =>
                game[`${player.id}_shipsPlaced`] ===
                Object.keys(CONFIG.SHIPS).length
            );

            if (allShipsPlaced) {
              game.gameState = CONFIG.GAME_STATES.RUNNING;
              this.io.to(game.id).emit("changeGameState", game.gameState);
              this.io
                .to(game.id)
                .emit("message", "All ships placed! Battle begins!");
              this.io.to(game.id).emit("nextRound");

              // Randomly choose who goes first
              const firstPlayer =
                Math.random() < 0.5 ? game.players[0] : game.players[1];
              this.io
                .to(game.id)
                .emit("yourTurn", socket.id === firstPlayer.id);
            }
          }
        }
      });

      socket.on("clickOnEnemyGrid", ({ x, y }) => {
        const game = this.games[state.gameId];
        if (game.gameState === CONFIG.GAME_STATES.RUNNING) {
          y = CONFIG.LETTERS.indexOf(y);
          const targetPlayer = game.players.find(
            (p) => p.id !== state.playerId
          );

          if (
            this.handleAttack(
              socket,
              game,
              state.playerId,
              targetPlayer.id,
              x,
              y
            )
          ) {
            // Update grids for both players
            socket.emit("updateGrid", {
              gridToUpdate: "enemyGrid",
              data: state.otherPlayerGrid,
            });
            socket.broadcast.to(game.id).emit("updateGrid", {
              gridToUpdate: "friendlyGrid",
              data: game[`${targetPlayer.id}_grid`],
            });

            // Switch turns
            this.io.to(game.id).emit("nextRound");
            socket.emit("yourTurn", false);
            socket.broadcast.to(game.id).emit("yourTurn", true);
          }
        }
      });

      socket.on("chatMessage", ({ playerName, message }) => {
        this.io.to(state.gameId).emit("chatMessage", { playerName, message });
      });

      socket.on("disconnect", () => {
        if (state.gameId && this.games[state.gameId]) {
          const game = this.games[state.gameId];

          this.io
            .to(state.gameId)
            .emit("message", `${state.playerName} has left the game.`);

          game.players = game.players.filter((p) => p.id !== state.playerId);
          game.gameState = CONFIG.GAME_STATES.OVER;

          this.io.to(state.gameId).emit("changeGameState", game.gameState);
          this.io
            .to(state.gameId)
            .emit(
              "message",
              "Game over - opponent disconnected. Returning to main menu in 10 seconds..."
            );

          if (game.players.length === 0) {
            delete this.games[state.gameId];
          }
        }
      });
    });
  }
}

// Start the server
new GameServer();
