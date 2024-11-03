import { createGridCell } from '../utils/domUtils.js';

export default class GridManager {
  static LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

  updateGrid(rootElement, captionText, data) {
    const tableHeaderCells = Array(10)
      .fill("")
      .map((_, i) => `<th>${i}</th>`)
      .join("");

    const tableContent = data
      .map(
        (rowData, y) => `
      <tr>
        <th>${GridManager.LETTERS[y]}</th>
        ${rowData
          .map(
            (cell, x) => `
          <td class="${createGridCell(cell)}" 
              data-x="${x}" 
              data-y="${GridManager.LETTERS[y]}">
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
}