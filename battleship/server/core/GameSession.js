const config = require("../config");
const {createEmptyGrid, isValidCoordinate} = require("../utils/gameUtils");
const GameStateManager = require("./GameStateManager");

class GameSession {
  constructor(socket, gameId, playerId, playerName) {
    this.socket = socket;
    this.gameId = gameId;
    this.playerId = playerId;
    this.playerName = playerName;
    this.game = GameStateManager.getGame(gameId);
    this.otherPlayerGrid = createEmptyGrid(config.GRID_SIZE);
    this.io = socket.server;
  }

  getOtherPlayerId() {
    return this.game.players.find((player) => player.id !== this.playerId).id;
  }

  handleShipPlacement({x, y, shipType, isVertical}) {
    if (this.game.gameState !== config.GAME_STATES.SETTING_SHIPS) return;
    if (!config.SHIPS[shipType] || this.game[`${this.playerId}_placedShips`][shipType]) {
      this.socket.emit("message", "Invalid ship selection or ship already placed");
      return;
    }

    const size = config.SHIPS[shipType].size;
    y = config.LETTERS.indexOf(y);

    if (!this.isValidShipPlacement(x, y, size, isVertical)) {
      this.socket.emit("message", "Invalid ship placement! Try another position.");
      return;
    }

    this.placeShip(x, y, size, isVertical);
    this.game[`${this.playerId}_placedShips`][shipType] = true;
    this.game[`${this.playerId}_shipCellsPlaced`] += size;
    this.game[`${this.playerId}_shipsPlaced`]++;

    this.socket.emit("shipPlaced", {shipType});
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

      if (!isValidCoordinate(checkX, checkY, config.GRID_SIZE) || grid[checkY][checkX] === 1) {
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

  handleAttack({x, y, isSquareBlast, isRadarScan}) {
    if (this.game.gameState !== config.GAME_STATES.RUNNING) return;

    const otherPlayerId = this.getOtherPlayerId();
    y = config.LETTERS.indexOf(y);

    // Handle Radar Scan
    if (isRadarScan) {
      const scanPositions = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const scanY = y + dy;
          const scanX = x + dx;
          if (isValidCoordinate(scanX, scanY, config.GRID_SIZE)) {
            scanPositions.push([scanY, scanX]);
          }
        }
      }

      let shipsDetected = 0;
      for (const [scanY, scanX] of scanPositions) {
        const cell = this.game[`${otherPlayerId}_grid`][scanY][scanX];
        if (cell === 1) {
          shipsDetected++;
        }
      }

      if (shipsDetected > 0) {
        let message;
        if (shipsDetected === 1) {
          message = "Radar detected a ship part in the scanned area!";
        } else if (shipsDetected <= 3) {
          message = `Radar detected a few ship parts (${shipsDetected}) in the scanned area!`;
        } else {
          message = `Radar detected many ship parts (${shipsDetected}) in the scanned area!`;
        }

        this.socket.emit("message", message);
        this.socket.broadcast.to(this.gameId).emit("message", "Enemy radar has scanned your ships!");
      } else {
        this.socket.emit("message", "Radar scan complete: Area is clear of ships.");
        this.socket.broadcast.to(this.gameId).emit("message", "Enemy radar has scanned your waters.");
      }

      return;
    }

    if (isSquareBlast) {
      const hitPositions = [
        [y, x], // Top left
        [y, x + 1], // Top right
        [y + 1, x], // Bottom left
        [y + 1, x + 1], // Bottom right
      ];

      let totalHits = 0;
      let newHits = false;

      for (const [hitY, hitX] of hitPositions) {
        if (!isValidCoordinate(hitX, hitY, config.GRID_SIZE)) continue;

        const targetCell = this.game[`${otherPlayerId}_grid`][hitY][hitX];

        if (targetCell === 2 || targetCell === 3) continue;

        newHits = true;
        const isHit = targetCell === 1;

        this.game[`${otherPlayerId}_grid`][hitY][hitX] = isHit ? 3 : 2;
        this.otherPlayerGrid[hitY][hitX] = isHit ? 3 : 2;

        if (isHit) {
          totalHits++;
          this.game[`${otherPlayerId}_shipsLost`]++;
        }
      }

      this.updateGrids();

      if (totalHits > 0) {
        this.socket.emit("message", `Square Blast hit ${totalHits} ship parts!`);
        this.socket.broadcast.to(this.gameId).emit("message", `Enemy's Square Blast hit ${totalHits} of your ship parts!`);

        if (this.game[`${otherPlayerId}_shipsLost`] >= config.TOTAL_SHIP_CELLS) {
          this.handleGameOver();
          return;
        }
      } else {
        this.socket.emit("message", "Square Blast missed all targets!");
        this.socket.broadcast.to(this.gameId).emit("message", "Enemy's Square Blast missed completely!");
      }

      this.nextTurn();
    } else {
      const targetCell = this.game[`${otherPlayerId}_grid`][y][x];

      if (targetCell === 2 || targetCell === 3) {
        this.socket.emit("message", "You already hit that spot!");
        return;
      }

      const hit = targetCell === 1;
      this.game[`${otherPlayerId}_grid`][y][x] = hit ? 3 : 2;
      this.otherPlayerGrid[y][x] = hit ? 3 : 2;

      this.updateGrids();

      if (hit) {
        this.game[`${otherPlayerId}_shipsLost`]++;

        this.socket.emit("message", "Direct hit! Take another shot!");
        this.socket.broadcast.to(this.gameId).emit("message", "Your ship was hit!");

        // Check for game over after updating grids
        if (this.game[`${otherPlayerId}_shipsLost`] >= config.TOTAL_SHIP_CELLS) {
          this.handleGameOver();
          return;
        }
      } else {
        this.socket.emit("message", "Miss! You hit water!");
        this.socket.broadcast.to(this.gameId).emit("message", "Enemy missed!");
        this.nextTurn();
      }
    }
  }

  updateGrids() {
    this.socket.emit("updateGrid", {
      gridToUpdate: "enemyGrid",
      data: this.otherPlayerGrid,
    });

    const otherPlayerId = this.getOtherPlayerId();
    this.socket.broadcast.to(this.gameId).emit("updateGrid", {
      gridToUpdate: "friendlyGrid",
      data: this.game[`${otherPlayerId}_grid`],
    });
  }

  nextTurn() {
    this.socket.emit("yourTurn", false);
    this.socket.broadcast.to(this.gameId).emit("yourTurn", true);
  }

  handleHit(otherPlayerId) {
    if (this.game[`${otherPlayerId}_shipsLost`] >= config.TOTAL_SHIP_CELLS) {
      this.handleGameOver();
      return;
    }

    this.socket.emit("message", "Direct hit!");
    this.socket.broadcast.to(this.gameId).emit("message", "Your ship was hit!");
  }

  handleGameOver() {
    this.game.gameState = config.GAME_STATES.OVER;
    this.io.to(this.gameId).emit("changeGameState", config.GAME_STATES.OVER);
    this.socket.emit("message", "Victory! All enemy ships destroyed!");
    this.socket.broadcast.to(this.gameId).emit("message", "Defeat! All ships lost!");
    this.io.to(this.gameId).emit("message", `${this.playerName} wins! Returning to menu in 10 seconds...`);
  }

  handleDisconnect() {
    this.io.to(this.gameId).emit("message", `${this.playerName} has left the game.`);

    this.game.players = this.game.players.filter((player) => player.id !== this.playerId);
    this.game.gameState = config.GAME_STATES.OVER;

    this.io.to(this.gameId).emit("changeGameState", config.GAME_STATES.OVER);
    this.io.to(this.gameId).emit("message", "Game over - opponent disconnected! Returning to menu in 10 seconds...");

    if (this.game.players.length === 0) {
      GameStateManager.removeGame(this.gameId);
    }
  }

  checkAllShipsPlaced() {
    const allShipsPlaced = Object.keys(config.SHIPS).length;
    const player1Ships = this.game[`${this.game.players[0].id}_shipsPlaced`];
    const player2Ships = this.game[`${this.game.players[1].id}_shipsPlaced`];

    if (player1Ships === allShipsPlaced && player2Ships === allShipsPlaced) {
      this.game.gameState = config.GAME_STATES.RUNNING;
      this.io.to(this.gameId).emit("changeGameState", config.GAME_STATES.RUNNING);
      this.io.to(this.gameId).emit("message", "All ships placed! Battle begins!");
      this.io.to(this.gameId).emit("nextRound");

      this.socket.emit("yourTurn", false);
      this.socket.broadcast.to(this.gameId).emit("yourTurn", true);
    }
  }
}

module.exports = GameSession;
