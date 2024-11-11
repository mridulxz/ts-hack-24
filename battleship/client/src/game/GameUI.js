import { getElement } from "../utils/domUtils.js";
import { MESSAGES } from "./config.js";
import GridManager from "./GridManager.js";

export default class GameUI {
  constructor(gameState) {
    this.state = gameState;
    this.gridManager = new GridManager();
    this.elements = {
      currentRound: getElement("#current-round-txt"),
      currentTurn: getElement("#current-turn-txt"),
      enemyGrid: getElement("#enemy-grid"),
      friendlyGrid: getElement("#friendly-grid"),
      chatForm: getElement("#console form"),
      chatMessages: getElement("#chat-messages-list"),
      chatInput: getElement("#chat-message-input"),
      buttons: {
        showRules: getElement("#show-rules-btn"),
        toggleMusic: getElement("#toogle-music-btn"),
        toggleSound: getElement("#toogle-sound-btn"),
        toggleFullscreen: getElement("#toggle-fullscreen-btn"),
        leaveGame: getElement("#leave-game-btn"),
      },
    };
    this.elements.powerups = {
      squareBlastBtn: getElement("#activate-square-blast"),
    };
  }

  initialize() {
    this.initializeDisplays();
    this.setupEventListeners();
  }

  initializeDisplays() {
    this.elements.currentRound.innerHTML = "0";
    this.elements.currentTurn.innerHTML = MESSAGES.WAIT_FOR_START;
    this.elements.chatInput.focus();
    this.initializeGrids();
  }

  setupEventListeners() {
    this.elements.powerups.squareBlastBtn.addEventListener("click", () => {
      if (
        this.state.powerups.squareBlast.count > 0 &&
        !this.state.powerups.squareBlast.isActive
      ) {
        this.state.powerups.squareBlast.isActive = true;
        this.elements.powerups.squareBlastBtn.textContent = "Active";
        this.elements.powerups.squareBlastBtn.classList.add("bg-green-500/40");
        this.addConsoleMessage(
          "Square Blast powerup activated! Your next attack will hit a 2x2 area."
        );
      }
    });
  }

  initializeGrids() {
    this.gridManager.updateGrid(
      this.elements.enemyGrid,
      MESSAGES.GRID_ENEMY,
      this.state.createEmptyGrid()
    );
    this.gridManager.updateGrid(
      this.elements.friendlyGrid,
      MESSAGES.GRID_HOME,
      this.state.createEmptyGrid()
    );
  }

  addConsoleMessage(message, sender = "[System]") {
    const messageElement = document.createElement("li");
    messageElement.innerHTML = `<strong>${sender}</strong>: ${message}`;
    this.elements.chatMessages.appendChild(messageElement);
    this.scrollChatToBottom();

    setTimeout(() => {
      messageElement.classList.add("fading");
      setTimeout(() => messageElement.remove(), 800);
    }, 8000);
  }

  scrollChatToBottom() {
    if (this.elements.chatMessages.dataset.autoScroll !== "false") {
      this.elements.chatMessages.scrollTop =
        this.elements.chatMessages.scrollHeight;
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
}
