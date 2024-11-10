import GameState from "./GameState.js";
import GameUI from "./GameUI.js";
import SocketHandler from "./SocketHandler.js";
import { MESSAGES } from "./config.js";

export default class BattleshipGame {
  constructor() {
    this.state = new GameState();
    this.ui = new GameUI(this.state);
    this.socket = null;
  }

  initialize() {
    const params = Qs.parse(location.search, { ignoreQueryPrefix: true });

    if (!this.validateParams(params)) {
      return;
      this.redirectToHome();
    }

    this.state.updateFromQueryParams(params);

    document.addEventListener("DOMContentLoaded", () => {
      this.ui.initialize();
      this.socket = new SocketHandler(this.state, this.ui);
      this.socket.initialize();
      window.history.replaceState({}, document.title, "/play");
      this.ui.addConsoleMessage(MESSAGES.INITIALIZING);
    });
  }

  validateParams(params) {
    return params.playerName && params.game && params.playerId;
  }

  redirectToHome() {
    window.location = "/";
  }
}

import BattleshipGame from "./game/BattleshipGame.js";

(() => {
  const game = new BattleshipGame();
  game.initialize();
})();
