const generateUUID = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

const createEmptyGrid = (size) =>
  Array(size)
    .fill()
    .map(() => Array(size).fill(0));

const isValidCoordinate = (x, y, gridSize) =>
  x >= 0 && x < gridSize && y >= 0 && y < gridSize;

module.exports = {
  generateUUID,
  createEmptyGrid,
  isValidCoordinate,
};
