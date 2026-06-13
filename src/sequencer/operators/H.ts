import { Cell } from "../cell.js";

// Halt — freezes the cell directly below it (Orca: H locks its southward
// operand). The skip lives in Sequencer._updateGrid; the halted cell never
// runs, so movers stop, clocks pause, and stars below an H persist.
export class H extends Cell {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "H";
  }
  update() { super.update(); }
}
