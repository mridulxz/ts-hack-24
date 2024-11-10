const config = {
    PORT: process.env.PORT || 5007,
    GRID_SIZE: 10,
    LETTERS: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    GAME_STATES: {
      INITIALIZING: "gameIsInitializing",
      INITIALIZED: "gameInitialized",
      SETTING_SHIPS: "setShipsRound",
      RUNNING: "gameRunning",
      OVER: "gameOver",
    },
    SHIPS: {
      carrier: { size: 5, count: 1 },
      battleship: { size: 4, count: 1 },
      cruiser: { size: 3, count: 1 },
      submarine: { size: 3, count: 1 },
      destroyer: { size: 2, count: 1 },
    },
    TOTAL_SHIP_CELLS: 17
  };
  
  module.exports = config;