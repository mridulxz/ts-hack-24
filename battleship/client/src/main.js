const STORAGE_KEYS = {
  PLAYER_ID: "playerId",
};

const SELECTORS = {
  TAB_TRIGGER: ".tab-trigger",
  SECONDARY_BTN: ".secondary-btn",
  GAMES_LIST: "#games-list",
  JOIN_FORM: "#join-form",
  CREATE_FORM: "#create-form",
  TAB: ".tab",
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

class GameUI {
  constructor(gameState) {
    this.state = gameState;
    this.elements = {
      tabTriggers: document.querySelectorAll(SELECTORS.TAB_TRIGGER),
      secondaryButtons: document.querySelectorAll(SELECTORS.SECONDARY_BTN),
      gamesList: document.querySelector(SELECTORS.GAMES_LIST),
      joinForm: document.querySelector(SELECTORS.JOIN_FORM),
      createForm: document.querySelector(SELECTORS.CREATE_FORM),
    };
  }

  initialize() {
    this.setupForms();
    this.registerEventListeners();
  }

  setupForms() {
    [this.elements.joinForm, this.elements.createForm].forEach((form) => {
      if (!form) return;

      const hiddenInput = document.createElement("input");
      hiddenInput.type = "hidden";
      hiddenInput.value = this.state.playerId;
      hiddenInput.name = "playerId";
      form.appendChild(hiddenInput);
    });
  }

  updateGamesList(games) {
    if (!this.elements.gamesList) return;

    this.elements.gamesList.innerHTML = games
      .filter((game) => game.players[0].id !== this.state.playerId)
      .map(
        (game) => `
        <option value="${game.id}">${game.gameName} (${game.players.length}/2)</option>
      `
      )
      .join("");
  }

  showTab(tabId) {
    const allTabs = document.querySelectorAll(SELECTORS.TAB);
    allTabs.forEach((tab) => tab.classList.add("hidden"));

    const targetTab = document.querySelector(`#${tabId}`);
    if (targetTab) {
      targetTab.classList.remove("hidden");
    }
  }

  toggleFullScreen() {
    const elem = document.body;
    const fullscreenApi = {
      requestFullscreen:
        elem.requestFullscreen ||
        elem.mozRequestFullScreen ||
        elem.webkitRequestFullScreen ||
        elem.msRequestFullscreen,
      exitFullscreen:
        document.exitFullscreen ||
        document.mozCancelFullScreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen,
    };

    if (
      !document.fullscreenElement &&
      !document.mozFullScreenElement &&
      !document.webkitFullscreenElement &&
      !document.msFullscreenElement
    ) {
      fullscreenApi.requestFullscreen.call(elem);
    } else {
      fullscreenApi.exitFullscreen.call(document);
    }
  }

  registerEventListeners() {
    this.elements.tabTriggers.forEach((trigger) => {
      trigger.addEventListener("click", async (e) => {
        const button = e.target.closest("button");
        if (!button) return;

        const targetTab = button.dataset.targets;
        this.showTab(targetTab);

        if (button.id === "join-btn") {
          const games = await this.state.updateGames();
          this.updateGamesList(games);
        }
      });
    });

    this.elements.secondaryButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        const elementId = e.target.closest("button").id;

        switch (elementId) {
          case "refresh-games-btn":
            e.preventDefault();
            const games = await this.state.updateGames();
            this.updateGamesList(games);
            break;

          case "toggle-music-btn":
            console.log("Toggle Music Btn Pressed!");
            alert("Coming Soon!");
            break;

          case "toggle-sound-btn":
            console.log("Toggle Sound Btn Pressed!");
            alert("Coming Soon!");
            break;

          case "toggle-fullscreen-btn":
            this.toggleFullScreen();
            break;
        }
      });
    });
  }
}

class BattleshipGame {
  constructor() {
    this.state = new GameState();
    this.ui = new GameUI(this.state);
  }

  async initialize() {
    this.state.initializePlayerId();
    await this.state.updateGames();
    this.ui.initialize();
    this.ui.updateGamesList(this.state.games);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new BattleshipGame();
  game.initialize();
});
