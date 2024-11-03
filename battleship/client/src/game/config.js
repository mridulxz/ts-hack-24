export const GRID_SIZE = 10;
export const GAME_STATES = {
  INITIALIZING: "gameIsInitializing",
  INITIALIZED: "gameInitialized",
  SETTING_SHIPS: "setShipsRound",
  RUNNING: "gameRunning",
  OVER: "gameOver",
};

export const SHIPS = {
  carrier: { size: 5, count: 1 },
  battleship: { size: 4, count: 1 },
  cruiser: { size: 3, count: 1 },
  destroyer: { size: 2, count: 1 },
  submarine: { size: 1, count: 1 },
};

export const MESSAGES = {
  INITIALIZING: "Please wait! Initializing Game...",
  WAIT_FOR_START: "Initializing Game...",
  LEAVE_CONFIRM: "Are you sure you want to leave the game?",
  GRID_ENEMY: "Enemy Waters",
  GRID_HOME: "Home Waters",
  ERROR_GAME_NOT_STARTED:
    "You cannot attack yet, because the game hasn't started. Please place all of your ships for the game to begin!",
  ERROR_WRONG_GRID:
    "There's no point in clicking here! Click on your enemies' play field to attack his ships.",
  ERROR_GAME_OVER: "Game is over! You can stop clicking!",
  SHIP_ALREADY_PLACED: (shipType) => `You've already placed your ${shipType}!`,
  SHIP_SELECTED: (shipType, size) =>
    `Selected ${shipType} (size: ${size}). Press R to rotate.`,
};