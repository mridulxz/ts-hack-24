class BattleshipLobby {
  constructor() {
    // Configuration
    this.CONFIG = {
      STORAGE_KEYS: {
        PLAYER_ID: "playerId",
      },
      ENDPOINTS: {
        GAMES: "/games",
      },
      REFRESH_INTERVAL: 10000, // 10 seconds
    };

    // State
    this.state = {
      playerId:
        localStorage.getItem(this.CONFIG.STORAGE_KEYS.PLAYER_ID) ||
        this.generateUUID(),
      games: [],
      activeTab: "main-tab",
    };

    // UI Elements
    this.ui = {};

    // Bind methods
    this.handleTabChange = this.handleTabChange.bind(this);
    this.handleSecondaryButtonClick =
      this.handleSecondaryButtonClick.bind(this);
    this.handleJoinFormSubmit = this.handleJoinFormSubmit.bind(this);
    this.handleCreateFormSubmit = this.handleCreateFormSubmit.bind(this);
    this.refreshGamesList = this.refreshGamesList.bind(this);
  }

  async initialize() {
    try {
      // Cache UI elements
      this.cacheUIElements();

      // Initialize player ID if needed
      if (!localStorage.getItem(this.CONFIG.STORAGE_KEYS.PLAYER_ID)) {
        localStorage.setItem(
          this.CONFIG.STORAGE_KEYS.PLAYER_ID,
          this.state.playerId
        );
      }

      // Set up event listeners
      this.setupEventListeners();

      // Add player ID to forms
      this.setupForms();

      // Initial games fetch
      await this.refreshGamesList();

      // Set up auto-refresh for games list
      this.startGameListRefresh();
    } catch (error) {
      console.error("Lobby initialization error:", error);
      this.showError(
        "Failed to initialize the game lobby. Please refresh the page."
      );
    }
  }

  cacheUIElements() {
    // Tab elements
    this.ui.tabs = {
      triggers: document.querySelectorAll(".tab-trigger"),
      content: document.querySelectorAll(".tab"),
    };

    // Button elements
    this.ui.secondaryButtons = document.querySelectorAll(".secondary-btn");

    // Form elements
    this.ui.forms = {
      join: document.querySelector("#join-form"),
      create: document.querySelector("#create-form"),
    };

    // Games list
    this.ui.gamesList = document.querySelector("#games-list");

    // Error container (create if doesn't exist)
    if (!document.querySelector("#error-container")) {
      const errorContainer = document.createElement("div");
      errorContainer.id = "error-container";
      errorContainer.className = "error-container";
      errorContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #ff4444;
        color: white;
        padding: 15px;
        border-radius: 5px;
        display: none;
        z-index: 1000;
      `;
      document.body.appendChild(errorContainer);
    }
    this.ui.errorContainer = document.querySelector("#error-container");
  }

  setupEventListeners() {
    // Tab navigation
    this.ui.tabs.triggers.forEach((trigger) => {
      trigger.addEventListener("click", this.handleTabChange);
    });

    // Secondary buttons
    this.ui.secondaryButtons.forEach((button) => {
      button.addEventListener("click", this.handleSecondaryButtonClick);
    });

    // Forms
    this.ui.forms.join.addEventListener("submit", this.handleJoinFormSubmit);
    this.ui.forms.create.addEventListener(
      "submit",
      this.handleCreateFormSubmit
    );
  }

  setupForms() {
    [this.ui.forms.join, this.ui.forms.create].forEach((form) => {
      const playerIdInput = document.createElement("input");
      playerIdInput.type = "hidden";
      playerIdInput.name = "playerId";
      playerIdInput.value = this.state.playerId;
      form.appendChild(playerIdInput);
    });
  }

  async handleTabChange(event) {
    try {
      const targetTab = event.target.dataset.targets;
      if (!targetTab) return;

      // Hide all tabs
      this.ui.tabs.content.forEach((tab) => tab.classList.add("hidden"));

      // Show target tab
      document.querySelector(`#${targetTab}`).classList.remove("hidden");

      // Update state
      this.state.activeTab = targetTab;

      // Refresh games list if switching to join tab
      if (targetTab === "join-tab") {
        await this.refreshGamesList();
      }
    } catch (error) {
      console.error("Tab change error:", error);
      this.showError("Failed to change tabs. Please try again.");
    }
  }

  async handleSecondaryButtonClick(event) {
    try {
      const buttonId = event.target.id;

      switch (buttonId) {
        case "refresh-games-btn":
          event.preventDefault();
          await this.refreshGamesList();
          break;

        case "toggle-fullscreen-btn":
          this.toggleFullScreen();
          break;

        case "toggle-music-btn":
        case "toggle-sound-btn":
          this.showFeatureNotImplemented();
          break;
      }
    } catch (error) {
      console.error("Button click error:", error);
      this.showError("Failed to process button click. Please try again.");
    }
  }

  async handleJoinFormSubmit(event) {
    try {
      const playerName = event.target
        .querySelector('[name="playerName"]')
        .value.trim();
      if (!playerName) {
        event.preventDefault();
        this.showError("Please enter a player name.");
        return;
      }

      const selectedGame = this.ui.gamesList.value;
      if (!selectedGame) {
        event.preventDefault();
        this.showError("Please select a game to join.");
        return;
      }
    } catch (error) {
      console.error("Join form submission error:", error);
      this.showError("Failed to join game. Please try again.");
      event.preventDefault();
    }
  }

  async handleCreateFormSubmit(event) {
    try {
      const playerName = event.target
        .querySelector('[name="playerName"]')
        .value.trim();
      if (!playerName) {
        event.preventDefault();
        this.showError("Please enter a player name.");
        return;
      }
    } catch (error) {
      console.error("Create form submission error:", error);
      this.showError("Failed to create game. Please try again.");
      event.preventDefault();
    }
  }

  async refreshGamesList() {
    try {
      const response = await fetch(this.CONFIG.ENDPOINTS.GAMES);
      if (!response.ok) throw new Error("Failed to fetch games");

      this.state.games = await response.json();
      this.updateGamesListUI();
    } catch (error) {
      console.error("Games refresh error:", error);
      this.showError("Failed to refresh games list. Please try again.");
    }
  }

  updateGamesListUI() {
    if (!this.ui.gamesList) return;

    // Clear current options
    this.ui.gamesList.innerHTML = "";

    // Filter out games where current player is the creator
    const availableGames = this.state.games.filter(
      (game) => game.players[0].id !== this.state.playerId
    );

    // Add games to select element
    availableGames.forEach((game) => {
      const option = document.createElement("option");
      option.value = game.id;
      option.textContent = `${game.gameName} (${game.players.length}/2)`;
      this.ui.gamesList.appendChild(option);
    });

    // Update UI based on available games
    const noGamesAvailable = availableGames.length === 0;
    this.ui.gamesList.disabled = noGamesAvailable;

    if (noGamesAvailable) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No games available";
      this.ui.gamesList.appendChild(option);
    }
  }

  startGameListRefresh() {
    setInterval(async () => {
      if (this.state.activeTab === "join-tab") {
        await this.refreshGamesList();
      }
    }, this.CONFIG.REFRESH_INTERVAL);
  }

  showError(message) {
    this.ui.errorContainer.textContent = message;
    this.ui.errorContainer.style.display = "block";

    setTimeout(() => {
      this.ui.errorContainer.style.display = "none";
    }, 5000);
  }

  showFeatureNotImplemented() {
    alert("Coming Soon!");
  }

  toggleFullScreen() {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle error:", error);
      this.showError("Failed to toggle fullscreen mode.");
    }
  }

  generateUUID() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

// Initialize lobby when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const lobby = new BattleshipLobby();
  lobby.initialize();
});
