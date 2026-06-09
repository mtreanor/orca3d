import { Cell } from "../cell.js";

export class Star extends Cell {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "*";
  }
  update() { super.update(); }
}
