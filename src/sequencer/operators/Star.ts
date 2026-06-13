import { Cell } from "../cell.js";

// Bang — erases itself at its own scan turn (Orca's `*` operator). A star
// written mid-tick survives until its turn next tick, so cells scanned after
// the producer see it same-frame and cells scanned before it see it next frame.
// A star directly below an H is never updated (halted) and persists.
export class Star extends Cell {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "*";
  }
  update() {
    super.update();
    if (this.justCreated()) return;
    this.clearAt(this.position.x, this.position.y, this.position.z);
  }
}
