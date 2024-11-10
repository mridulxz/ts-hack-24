export const getElement = (selector) => document.querySelector(selector);
export const getElements = (selector) => document.querySelectorAll(selector);

export const createGridCell = (value) => {
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
