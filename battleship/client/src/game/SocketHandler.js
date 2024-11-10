export default class SocketHandler {
    constructor(gameState, gameUI) {
      this.state = gameState;
      this.ui = gameUI;
      this.socket = io();
    }
  
    initialize() {
      this.setupListeners();
      this.joinGame();
    }
  
    setupListeners() {
      this.socket.on("message", (msg) => this.ui.addConsoleMessage(msg));
      this.socket.on("chatMessage", ({ playerName, message }) => {
        this.ui.addConsoleMessage(message, playerName);
      });
      this.socket.on("nextRound", () => this.handleNextRound());
      this.socket.on("yourTurn", (value) => this.handleTurnChange(value));
      this.socket.on("updateGrid", ({ gridToUpdate, data }) => this.handleGridUpdate(gridToUpdate, data));
      this.socket.on("shipPlaced", ({ shipType }) => this.handleShipPlaced(shipType));
      this.socket.on("changeGameState", (newGameState) => this.handleGameStateChange(newGameState));
    }
  
    joinGame() {
      this.socket.emit("joinGame", {
        gameId: this.state.gameId,
        playerId: this.state.playerId,
        playerName: this.state.playerName,
      });
    }
  
    handleNextRound() {
      this.state.currentRound++;
      this.ui.elements.currentRound.innerHTML = this.state.currentRound;
    }
  
    handleTurnChange(value) {
      this.state.yourTurn = value;
      this.ui.elements.currentTurn.innerHTML = value
        ? "It's your turn!"
        : "Other player's turn...";
    }
  
    handleGridUpdate(gridToUpdate, data) {
      const grid = gridToUpdate === "enemyGrid" 
        ? this.ui.elements.enemyGrid 
        : this.ui.elements.friendlyGrid;
      const caption = gridToUpdate === "enemyGrid"
        ? MESSAGES.GRID_ENEMY
        : MESSAGES.GRID_HOME;
      this.ui.gridManager.updateGrid(grid, caption, data);
    }
  }