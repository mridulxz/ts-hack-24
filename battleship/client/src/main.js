const STORAGE_KEYS = {
  PLAYER_ID: "playerId",
};

class GameState {
  constructor() {
    this.playerId = localStorage.getItem(STORAGE_KEYS.PLAYER_ID) || "";
    this.games = [];
  }

  initializePlayerId() {
    if (!this.playerId) {
      this.playerId = this.generateUUID();
      localStorage.setItem(STORAGE_KEYS.PLAYER_ID, this.playerId);
    }
    return this.playerId;
  }

  generateUUID() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async updateGames() {
    this.games = await this.fetchGames();
    return this.games;
  }

  async fetchGames() {
    try {
      const response = await fetch("/games");
      return await response.json();
    } catch (error) {
      console.error("Error fetching games:", error);
      return [];
    }
  }
}

class MainMenuUI {
  constructor(gameState) {
    this.state = gameState;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.getElementById("create-btn")?.addEventListener("click", () => {
      window.location.href = "/create";
    });

    document.getElementById("join-btn")?.addEventListener("click", () => {
      window.location.href = "/join";
    });

    this.initializeCommonButtons();
  }

  initializeCommonButtons() {
    const toggleFullscreen = document.getElementById("toggle-fullscreen-btn");
    const toggleMusic = document.getElementById("toggle-music-btn");
    const toggleSound = document.getElementById("toggle-sound-btn");
    const showRules = document.getElementById("show-rules-btn");

    toggleFullscreen?.addEventListener(
      "click",
      this.toggleFullScreen.bind(this)
    );
    toggleMusic?.addEventListener("click", () => alert("Coming Soon!"));
    toggleSound?.addEventListener("click", () => alert("Coming Soon!"));
    showRules?.addEventListener("click", () => alert("Coming Soon!"));
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
}

class CreateGameUI {
  constructor(gameState) {
    this.state = gameState;
    this.form = document.getElementById("create-form");
    this.initializeForm();
  }

  initializeForm() {
    if (!this.form) return;

    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.value = this.state.playerId;
    hiddenInput.name = "playerId";
    this.form.appendChild(hiddenInput);
  }
}

class JoinGameUI {
  constructor(gameState) {
    this.state = gameState;
    this.form = document.getElementById("join-form");
    this.gamesList = document.getElementById("games-list");
    this.refreshButton = document.getElementById("refresh-games-btn");
    this.initialize();
  }

  async initialize() {
    if (!this.form || !this.gamesList) return;

    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.value = this.state.playerId;
    hiddenInput.name = "playerId";
    this.form.appendChild(hiddenInput);

    await this.updateGamesList();
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.refreshButton?.addEventListener("click", async (e) => {
      e.preventDefault();
      await this.updateGamesList();
    });
  }

  async updateGamesList() {
    if (!this.gamesList) return;

    const games = await this.state.updateGames();
    this.gamesList.innerHTML = games
      .filter((game) => game.players[0].id !== this.state.playerId)
      .map(
        (game) => `
        <option value="${game.id}">${game.gameName} (${game.players.length}/2)</option>
      `
      )
      .join("");
  }
}

class BattleshipApp {
  constructor() {
    this.state = new GameState();
    this.currentPage = this.detectCurrentPage();
  }

  detectCurrentPage() {
    const path = window.location.pathname;
    return path.substring(1) || "index";
  }

  initialize() {
    this.state.initializePlayerId();

    switch (this.currentPage) {
      case "index":
        this.ui = new MainMenuUI(this.state);
        break;
      case "create":
        this.ui = new CreateGameUI(this.state);
        break;
      case "join":
        this.ui = new JoinGameUI(this.state);
        break;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new BattleshipApp();
  app.initialize();
});
