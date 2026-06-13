import { Cell } from "../cell.js";

export class CommentOperation extends Cell {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "#";
    // No inputs or outputs — purely an annotation marker with a facing direction
  }
}
