const config = require("../config");
const { createEmptyGrid } = require("../utils/gameUtils");

class GameStateManager {
  constructor() {
    this.games = {};
  }

  createGame(gameId, game) {
    this.games[gameId] = game;
  }

  getGame(gameId) {
    return this.games[gameId];
  }

  removeGame(gameId) {
    delete this.games[gameId];
  }

  getAvailableGames() {
    return Object.values(this.games).filter(
      (game) => !game.isGameFull() && game.isListed
    );
  }

  initializePlayerData(gameId, playerId) {
    const game = this.games[gameId];
    game[`${playerId}_grid`] = createEmptyGrid(config.GRID_SIZE);
    game[`${playerId}_shipsPlaced`] = 0;
    game[`${playerId}_shipCellsPlaced`] = 0;
    game[`${playerId}_shipsLost`] = 0;
    game[`${playerId}_placedShips`] = Object.keys(config.SHIPS).reduce(
      (acc, ship) => ({ ...acc, [ship]: false }),
      {}
    );
  }
}

module.exports = new GameStateManager();
