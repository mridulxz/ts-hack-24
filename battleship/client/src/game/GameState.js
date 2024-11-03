import { GAME_STATES, GRID_SIZE, SHIPS } from './config.js';

export default class GameState {
  constructor() {
    this.gameId = "";
    this.gameState = GAME_STATES.INITIALIZING;
    this.playerName = "";
    this.playerId = "";
    this.enemyPlayerGridData = this.createEmptyGrid();
    this.playerGridData = this.createEmptyGrid();
    this.currentRound = 0;
    this.yourTurn = false;
    this.selectedShipType = null;
    this.isVertical = false;
    this.placedShips = Object.keys(SHIPS).reduce(
      (acc, ship) => ({ ...acc, [ship]: false }),
      {}
    );
  }

  createEmptyGrid() {
    return Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  }

  updateFromQueryParams(params) {
    this.gameId = params.game || "";
    this.playerName = params.playerName || "";
    this.playerId = params.playerId || "";
  }
}