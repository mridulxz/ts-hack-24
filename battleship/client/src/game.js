class BattleshipGame {
  constructor() {
    this.GRID_SIZE = 10;
    this.GAME_STATES = {
      INITIALIZING: "gameIsInitializing",
      INITIALIZED: "gameInitialized",
      SETTING_SHIPS: "setShipsRound",
      RUNNING: "gameRunning",
      OVER: "gameOver",
    };

    this.SHIPS = {
      carrier: { size: 5, count: 1 },
      battleship: { size: 4, count: 1 },
      cruiser: { size: 3, count: 1 },
      destroyer: { size: 2, count: 1 },
      submarine: { size: 1, count: 1 },
    };

    this.MESSAGES = {
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
      SHIP_ALREADY_PLACED: (shipType) =>
        `You've already placed your ${shipType}!`,
      SHIP_SELECTED: (shipType, size) =>
        `Selected ${shipType} (size: ${size}). Press R to rotate.`,
    };

    this.state = {
      gameId: "",
      gameState: this.GAME_STATES.INITIALIZING,
      playerName: "",
      playerId: "",
      enemyPlayerGridData: this.createEmptyGrid(),
      playerGridData: this.createEmptyGrid(),
      currentRound: 0,
      yourTurn: false,
      selectedShipType: null,
      isVertical: false,
      placedShips: Object.keys(this.SHIPS).reduce(
        (acc, ship) => ({ ...acc, [ship]: false }),
        {}
      ),
    };

    this.socket = null;

    this.ui = {
      currentRound: null,
      currentTurn: null,
      enemyGrid: null,
      friendlyGrid: null,
      chatForm: null,
      chatMessages: null,
      chatInput: null,
      buttons: {
        showRules: null,
        toggleMusic: null,
        toggleSound: null,
        toggleFullscreen: null,
        leaveGame: null,
      },
    };
  }

  initialize() {
    const { playerName, game, playerId } = Qs.parse(location.search, {
      ignoreQueryPrefix: true,
    });

    if (!playerName || !game || !playerId) {
      this.redirectToHome();
      return;
    }

    this.state.gameId = game;
    this.state.playerName = playerName;
    this.state.playerId = playerId;

    this.initializeSocket();

    document.addEventListener("DOMContentLoaded", () => this.initializeUI());
  }

  initializeUI() {
    this.ui.currentRound = document.querySelector("#current-round-txt");
    this.ui.currentTurn = document.querySelector("#current-turn-txt");
    this.ui.enemyGrid = document.querySelector("#enemy-grid");
    this.ui.friendlyGrid = document.querySelector("#friendly-grid");
    this.ui.chatForm = document.querySelector("#console form");
    this.ui.chatMessages = document.querySelector("#chat-messages-list");
    this.ui.chatInput = document.querySelector("#chat-message-input");

    this.ui.buttons = {
      leaveGame: document.querySelector("#leave-game-btn"),
    };

    this.ui.currentRound.innerHTML = "0";
    this.ui.currentTurn.innerHTML = this.MESSAGES.WAIT_FOR_START;
    this.ui.chatInput.focus();

    this.initializeGrids();
    this.setupEventListeners();

    window.history.replaceState({}, document.title, "/play");
    this.addConsoleMessage(this.MESSAGES.INITIALIZING);
  }

  initializeSocket() {
    this.socket = io();
    window.onclose = () => this.socket.disconnect();

    this.setupSocketListeners();

    this.socket.emit("joinGame", {
      gameId: this.state.gameId,
      playerId: this.state.playerId,
      playerName: this.state.playerName,
    });
  }

  setupSocketListeners() {
    this.socket.on("message", (msg) => this.addConsoleMessage(msg));

    this.socket.on("chatMessage", ({ playerName, message }) => {
      this.addConsoleMessage(message, playerName);
    });

    this.socket.on("nextRound", () => {
      this.state.currentRound++;
      this.ui.currentRound.innerHTML = this.state.currentRound;
    });

    this.socket.on("yourTurn", (value) => {
      this.state.yourTurn = value;
      this.ui.currentTurn.innerHTML = value
        ? "It's your turn!"
        : "Other player's turn...";
    });

    this.socket.on("updateGrid", ({ gridToUpdate, data }) => {
      const grid =
        gridToUpdate === "enemyGrid" ? this.ui.enemyGrid : this.ui.friendlyGrid;
      const caption =
        gridToUpdate === "enemyGrid"
          ? this.MESSAGES.GRID_ENEMY
          : this.MESSAGES.GRID_HOME;
      this.updateGrid(grid, caption, data);
    });

    this.socket.on("shipPlaced", ({ shipType }) => {
      this.state.placedShips[shipType] = true;
      this.updateShipTableUI(shipType);
    });

    this.socket.on("changeGameState", (newGameState) =>
      this.handleGameStateChange(newGameState)
    );
  }

  setupEventListeners() {
    [this.ui.enemyGrid, this.ui.friendlyGrid].forEach((grid) => {
      grid.addEventListener("click", (e) => this.handleGridClick(e));
    });

    document.querySelectorAll(".info table tbody tr").forEach((row) => {
      row.addEventListener("click", () => this.handleShipSelection(row));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r") {
        this.state.isVertical = !this.state.isVertical;
        this.addConsoleMessage(
          `Rotation: ${this.state.isVertical ? "Vertical" : "Horizontal"}`
        );
      }
    });

    this.ui.buttons.leaveGame.addEventListener("click", () => this.leaveGame());

    document.addEventListener("keydown", (e) => {
      if (e.keyCode === 13) this.ui.chatInput.focus();
    });

    this.ui.chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.socket.emit("chatMessage", {
        playerName: this.state.playerName,
        message: this.ui.chatInput.value,
      });
      this.ui.chatInput.value = "";
      this.ui.chatInput.focus();
    });
  }

  handleGridClick(e) {
    if (!e.target.classList.contains("cell")) return;

    const grid = e.target.closest(".grid");
    const x = e.target.dataset.x;
    const y = e.target.dataset.y;

    if (this.state.gameState === this.GAME_STATES.OVER) {
      this.addConsoleMessage(this.MESSAGES.ERROR_GAME_OVER);
      return;
    }

    if (
      this.state.gameState === this.GAME_STATES.RUNNING &&
      this.state.yourTurn
    ) {
      if (grid.id === "enemy-grid") {
        this.socket.emit("clickOnEnemyGrid", { x, y });
      } else {
        this.addConsoleMessage(this.MESSAGES.ERROR_WRONG_GRID);
      }
    } else if (this.state.gameState === this.GAME_STATES.SETTING_SHIPS) {
      if (grid.id === "enemy-grid") {
        this.addConsoleMessage(this.MESSAGES.ERROR_GAME_NOT_STARTED);
      } else if (!this.state.selectedShipType) {
        this.addConsoleMessage(
          "Please select a ship type first by clicking on it in the Fleet table"
        );
      } else {
        this.socket.emit("clickOnFriendlyGrid", {
          x: parseInt(x),
          y,
          shipType: this.state.selectedShipType,
          isVertical: this.state.isVertical,
        });
        this.state.selectedShipType = null;
      }
    }
  }

  handleShipSelection(row) {
    const shipType = row.cells[1].textContent.toLowerCase();
    if (!this.SHIPS[shipType]) return;

    if (this.state.placedShips[shipType]) {
      this.addConsoleMessage(this.MESSAGES.SHIP_ALREADY_PLACED(shipType));
      this.state.selectedShipType = null;
      return;
    }

    this.state.selectedShipType = shipType;
    this.addConsoleMessage(
      this.MESSAGES.SHIP_SELECTED(shipType, this.SHIPS[shipType].size)
    );
  }

  handleGameStateChange(newGameState) {
    this.state.gameState = newGameState;

    switch (newGameState) {
      case this.GAME_STATES.INITIALIZED:
        this.ui.currentTurn.innerHTML = "Initialized";
        break;
      case this.GAME_STATES.SETTING_SHIPS:
        this.ui.currentTurn.innerHTML = "Place your ships!";
        break;
      case this.GAME_STATES.RUNNING:
        this.ui.currentTurn.innerHTML = "Let the fighting begin!";
        break;
      case this.GAME_STATES.OVER:
        this.ui.currentTurn.innerHTML = "Game Over!";
        setTimeout(() => this.redirectToHome(), 10000);
        break;
    }
  }

  updateShipTableUI(shipType) {
    const shipRow = Array.from(
      document.querySelectorAll(".info table tbody tr")
    ).find((row) => row.cells[1].textContent.toLowerCase() === shipType);

    if (shipRow) {
      shipRow.classList.add("placed");
    }
  }

  createEmptyGrid() {
    return Array(this.GRID_SIZE)
      .fill()
      .map(() => Array(this.GRID_SIZE).fill(0));
  }

  initializeGrids() {
    const grids = [this.ui.enemyGrid, this.ui.friendlyGrid];
    const captions = [this.MESSAGES.GRID_ENEMY, this.MESSAGES.GRID_HOME];
    grids.forEach((grid, index) => {
      this.updateGrid(grid, captions[index], this.createEmptyGrid());
    });
  }

  updateGrid(rootElement, captionText, data) {
    const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

    const getCellClass = (value) => {
      switch (value) {
        case 3:
          return "cell ship-hit";
        case 2:
          return "cell water-hit";
        case 1:
          return "cell ship";
        default:
          return "cell";
      }
    };

    const tableHeaderCells = Array(10)
      .fill("")
      .map((_, i) => `<th>${i}</th>`)
      .join("");

    const tableContent = data
      .map(
        (rowData, y) => `
      <tr>
        <th>${letters[y]}</th>
        ${rowData
          .map(
            (cell, x) => `
          <td class="${getCellClass(cell)}" 
              data-x="${x}" 
              data-y="${letters[y]}">
          </td>`
          )
          .join("")}
      </tr>
    `
      )
      .join("");

    rootElement.innerHTML = `
      <table>
        <caption>
          <h5><strong>${captionText}</strong></h5>
        </caption>
        <thead>
          <tr>
            <th></th>
            ${tableHeaderCells}
          </tr>
        </thead>
        <tbody>
          ${tableContent}
        </tbody>
      </table>
    `;
  }

  addConsoleMessage(message, sender = "[System]") {
    const messageElement = document.createElement("li");
    messageElement.innerHTML = `<strong>${sender}</strong>: ${message}`;

    this.ui.chatMessages.appendChild(messageElement);
    this.scrollChatToBottom();

    // fade out message after delay
    setTimeout(() => {
      messageElement.classList.add("fading");
      setTimeout(() => messageElement.remove(), 800);
    }, 15000);
  }

  scrollChatToBottom() {
    if (this.ui.chatMessages.dataset.autoScroll !== "false") {
      this.ui.chatMessages.scrollTop = this.ui.chatMessages.scrollHeight;
    }
  }

  toggleFullScreen() {
    const elem = document.body;
    if (!document.fullscreenElement) {
      elem.requestFullscreen?.() ||
        elem.mozRequestFullScreen?.() ||
        elem.webkitRequestFullScreen?.() ||
        elem.msRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() ||
        document.mozCancelFullScreen?.() ||
        document.webkitExitFullscreen?.() ||
        document.msExitFullscreen?.();
    }
  }

  leaveGame() {
    if (confirm(this.MESSAGES.LEAVE_CONFIRM)) {
      this.socket.disconnect();
      this.redirectToHome();
    }
  }

  redirectToHome() {
    window.location = "/";
  }
}

(() => {
  const game = new BattleshipGame();
  game.initialize();
})();
