import { Cell } from "../cell.js";

// Hold — barrier that prevents star clearing and mover movement
export class H extends Cell {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "H";
  }
  update() { super.update(); }
}
