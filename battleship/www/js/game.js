class BattleshipGame {
  constructor() {
    // Configuration
    this.CONFIG = {
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
        destroyer: { size: 2, count: 1 },
        submarine: { size: 1, count: 1 },
      },
      GRID_SIZE: 10,
      LETTERS: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    };

    // Game state
    this.state = {
      gameId: null,
      gameState: this.CONFIG.GAME_STATES.INITIALIZING,
      playerName: "",
      playerId: "",
      enemyGridData: this.getInitialGridData(),
      playerGridData: this.getInitialGridData(),
      currentRound: 0,
      yourTurn: false,
      selectedShipType: null,
      isVertical: false,
      placedShips: Object.fromEntries(
        Object.keys(this.CONFIG.SHIPS).map((ship) => [ship, false])
      ),
    };

    // UI Elements cache
    this.ui = {};

    // Socket instance
    this.socket = null;

    // Bind methods to maintain context
    this.handleGridClick = this.handleGridClick.bind(this);
    this.handleShipSelection = this.handleShipSelection.bind(this);
    this.handleChatSubmit = this.handleChatSubmit.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }

  async initialize() {
    try {
      // Get URL parameters
      const params = Qs.parse(location.search, { ignoreQueryPrefix: true });
      const { playerName, game, playerId } = params;

      if (!playerName || !game || !playerId) {
        this.redirectToHome();
        return;
      }

      // Set initial state
      this.state.gameId = game;
      this.state.playerName = playerName;
      this.state.playerId = playerId;

      // Initialize socket connection
      this.socket = io();

      // Cache UI elements
      this.cacheUIElements();

      // Set up event listeners
      this.setupEventListeners();

      // Set up socket event handlers
      this.setupSocketHandlers();

      // Join game
      this.socket.emit("joinGame", {
        gameId: this.state.gameId,
        playerId: this.state.playerId,
        playerName: this.state.playerName,
      });

      // Initialize UI
      this.initializeUI();

      // Clean up URL
      window.history.replaceState({}, document.title, "/play.html");
    } catch (error) {
      console.error("Game initialization error:", error);
      this.redirectToHome();
    }
  }

  cacheUIElements() {
    // Header elements
    this.ui.headerLogoLink = document.querySelector(".header .logo a");
    this.ui.currentRoundText = document.querySelector("#current-round-txt");
    this.ui.currentTurnText = document.querySelector("#current-turn-txt");

    // Grid elements
    this.ui.enemyGrid = document.querySelector("#enemy-grid");
    this.ui.friendlyGrid = document.querySelector("#friendly-grid");

    // Chat elements
    this.ui.chatForm = document.querySelector("#console form");
    this.ui.chatMessagesList = document.querySelector("#chat-messages-list");
    this.ui.chatInput = document.querySelector("#chat-message-input");

    // Button elements
    this.ui.showRulesBtn = document.querySelector("#show-rules-btn");
    this.ui.toggleMusicBtn = document.querySelector("#toogle-music-btn");
    this.ui.toggleSoundBtn = document.querySelector("#toogle-sound-btn");
    this.ui.toggleFullScreenBtn = document.querySelector(
      "#toggle-fullscreen-btn"
    );
    this.ui.leaveGameBtn = document.querySelector("#leave-game-btn");

    // Ship selection rows
    this.ui.shipRows = document.querySelectorAll(".info table tbody tr");
  }

  setupEventListeners() {
    // Grid click handlers
    this.ui.enemyGrid.addEventListener("click", this.handleGridClick);
    this.ui.friendlyGrid.addEventListener("click", this.handleGridClick);

    // Ship selection handlers
    this.ui.shipRows.forEach((row) => {
      row.addEventListener("click", this.handleShipSelection);
    });

    // Chat handlers
    this.ui.chatForm.addEventListener("submit", this.handleChatSubmit);

    // Button handlers
    this.ui.headerLogoLink.addEventListener("click", (e) => {
      e.preventDefault();
      this.leaveGame();
    });

    this.ui.leaveGameBtn.addEventListener("click", () => this.leaveGame());
    this.ui.toggleFullScreenBtn.addEventListener("click", () =>
      this.toggleFullScreen()
    );

    // Keyboard handlers
    document.addEventListener("keydown", this.handleKeyPress);
  }

  setupSocketHandlers() {
    this.socket.on("message", (message) => {
      this.addConsoleMessage(message);
    });

    this.socket.on("chatMessage", ({ playerName, message }) => {
      this.addConsoleMessage(message, playerName);
    });

    this.socket.on("nextRound", () => {
      this.state.currentRound++;
      this.ui.currentRoundText.innerHTML = this.state.currentRound;
    });

    this.socket.on("yourTurn", (value) => {
      this.state.yourTurn = value;
      this.ui.currentTurnText.innerHTML = value
        ? "It's your turn!"
        : "Other player's turn...";
    });

    this.socket.on("updateGrid", ({ gridToUpdate, data }) => {
      const grid =
        gridToUpdate === "enemyGrid" ? this.ui.enemyGrid : this.ui.friendlyGrid;
      const caption =
        gridToUpdate === "enemyGrid" ? "Enemy Waters" : "Home Waters";
      this.updateGrid(grid, caption, data);
    });

    this.socket.on("shipPlaced", ({ shipType }) => {
      this.state.placedShips[shipType] = true;
      this.updateShipRowStatus(shipType);
    });

    this.socket.on("changeGameState", (newGameState) => {
      this.handleGameStateChange(newGameState);
    });
  }

  handleGameStateChange(newGameState) {
    this.state.gameState = newGameState;

    switch (newGameState) {
      case this.CONFIG.GAME_STATES.INITIALIZED:
        this.ui.currentTurnText.innerHTML = "Initialized";
        break;

      case this.CONFIG.GAME_STATES.SETTING_SHIPS:
        this.ui.currentTurnText.innerHTML = "Place your ships!";
        break;

      case this.CONFIG.GAME_STATES.RUNNING:
        this.ui.currentTurnText.innerHTML = "Let the fighting begin!";
        break;

      case this.CONFIG.GAME_STATES.OVER:
        this.ui.currentTurnText.innerHTML = "Game Over!";
        setTimeout(() => this.redirectToHome(), 10000);
        break;
    }
  }

  handleGridClick(event) {
    const cell = event.target;
    if (!cell.classList.contains("cell")) return;

    const grid = event.currentTarget;
    const x = parseInt(cell.dataset.x);
    const y = cell.dataset.y;

    if (this.state.gameState === this.CONFIG.GAME_STATES.OVER) {
      this.addConsoleMessage("Game is over! You can stop clicking!");
      return;
    }

    if (grid.id === "enemy-grid") {
      this.handleEnemyGridClick(x, y);
    } else {
      this.handleFriendlyGridClick(x, y);
    }
  }

  handleEnemyGridClick(x, y) {
    if (
      this.state.gameState !== this.CONFIG.GAME_STATES.RUNNING ||
      !this.state.yourTurn
    ) {
      this.addConsoleMessage("It's not your turn yet!");
      return;
    }

    this.socket.emit("clickOnEnemyGrid", { x, y });
  }

  handleFriendlyGridClick(x, y) {
    if (this.state.gameState !== this.CONFIG.GAME_STATES.SETTING_SHIPS) {
      this.addConsoleMessage(
        "You can only place ships during the setup phase!"
      );
      return;
    }

    if (!this.state.selectedShipType) {
      this.addConsoleMessage("Please select a ship type first!");
      return;
    }

    this.socket.emit("clickOnFriendlyGrid", {
      x,
      y,
      shipType: this.state.selectedShipType,
      isVertical: this.state.isVertical,
    });

    this.state.selectedShipType = null;
  }

  handleShipSelection(event) {
    const row = event.currentTarget;
    const shipType = row.cells[1].textContent.toLowerCase();

    if (!this.CONFIG.SHIPS[shipType]) return;

    if (this.state.placedShips[shipType]) {
      this.addConsoleMessage(`You've already placed your ${shipType}!`);
      this.state.selectedShipType = null;
      return;
    }

    this.state.selectedShipType = shipType;
    this.addConsoleMessage(
      `Selected ${shipType} (size: ${this.CONFIG.SHIPS[shipType].size}). Press R to rotate.`
    );
  }

  handleKeyPress(event) {
    if (event.key === "r" || event.key === "R") {
      this.state.isVertical = !this.state.isVertical;
      this.addConsoleMessage(
        `Rotation: ${this.state.isVertical ? "Vertical" : "Horizontal"}`
      );
    }
  }

  handleChatSubmit(event) {
    event.preventDefault();
    const message = this.ui.chatInput.value.trim();

    if (message) {
      this.socket.emit("chatMessage", {
        playerName: this.state.playerName,
        message,
      });
      this.ui.chatInput.value = "";
    }

    this.ui.chatInput.focus();
  }

  updateGrid(rootElement, captionText, data) {
    const tableHeaderCells = Array.from(
      { length: this.CONFIG.GRID_SIZE },
      (_, i) => `<th>${i}</th>`
    ).join("");

    const tableContent = data
      .map((rowData, indexY) => {
        const cells = rowData
          .map((cellData, indexX) => {
            const cellClass = this.getCellClass(cellData);
            return `<td class="cell ${cellClass}" data-x="${indexX}" data-y="${this.CONFIG.LETTERS[indexY]}"></td>`;
          })
          .join("");

        return `
        <tr>
          <th>${this.CONFIG.LETTERS[indexY]}</th>
          ${cells}
        </tr>
      `;
      })
      .join("");

    rootElement.innerHTML = `
      <table>
        <caption><h5><strong>${captionText}</strong></h5></caption>
        <thead>
          <tr><th></th>${tableHeaderCells}</tr>
        </thead>
        <tbody>${tableContent}</tbody>
      </table>
    `;
  }

  getCellClass(cellData) {
    switch (cellData) {
      case 3:
        return "ship-hit";
      case 2:
        return "water-hit";
      case 1:
        return "ship";
      default:
        return "";
    }
  }

  updateShipRowStatus(shipType) {
    const shipRow = Array.from(this.ui.shipRows).find(
      (row) => row.cells[1].textContent.toLowerCase() === shipType
    );
    if (shipRow) {
      shipRow.classList.add("placed");
    }
  }

  addConsoleMessage(message, sender = "[System]") {
    const messageElement = document.createElement("li");
    messageElement.innerHTML = `<strong>${sender}</strong>: ${message}`;
    
    this.ui.chatMessagesList.appendChild(messageElement);

    let fadeTimeout;
    const startFadeOut = () => {
      fadeTimeout = setTimeout(() => {
        messageElement.classList.add('fading');
        setTimeout(() => {
          if (messageElement.parentElement) {
            messageElement.remove();
          }
        }, 1000);
      }, 15000);
    };

    messageElement.addEventListener('mouseenter', () => {
      clearTimeout(fadeTimeout);
      messageElement.classList.remove('fading');
    });

    messageElement.addEventListener('mouseleave', () => {
      startFadeOut();
    });

    startFadeOut();
    
    const isAtBottom = this.ui.chatMessagesList.scrollHeight - this.ui.chatMessagesList.scrollTop === this.ui.chatMessagesList.clientHeight;
    if (isAtBottom) {
      this.ui.chatMessagesList.scrollTop = this.ui.chatMessagesList.scrollHeight;
    }
  }

  getInitialGridData() {
    return Array.from({ length: this.CONFIG.GRID_SIZE }, () =>
      Array(this.CONFIG.GRID_SIZE).fill(0)
    );
  }

  toggleFullScreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  leaveGame() {
    if (confirm("Are you sure you want to leave the game?")) {
      this.socket.disconnect();
      this.redirectToHome();
    }
  }

  redirectToHome() {
    window.location = "/";
  }

  initializeUI() {
    this.ui.chatInput.focus();
    this.ui.currentRoundText.innerHTML = "0";
    this.ui.currentTurnText.innerHTML = "Initializing Game...";
    this.addConsoleMessage("Please wait! Initializing Game...");

    // Initialize grids
    this.updateGrid(
      this.ui.enemyGrid,
      "Enemy Waters",
      this.state.enemyGridData
    );
    this.updateGrid(
      this.ui.friendlyGrid,
      "Home Waters",
      this.state.playerGridData
    );
  }
}

// Initialize game when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const game = new BattleshipGame();
  game.initialize();
});
