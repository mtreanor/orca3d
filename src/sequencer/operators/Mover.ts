import { Cell } from "../cell.js";
import { Vec3, addVec3 } from "../vec3.js";

export class Mover extends Cell {
  direction: Vec3 = { x: 1, y: 0, z: 0 };

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "Mover";
  }

  move() {
    if (this.justCreated()) return;
    const next = addVec3(this.position, this.direction);
    const collided = this.readCell(next.x, next.y, next.z) !== "";

    if (collided) {
      this.clearAt(this.position.x, this.position.y, this.position.z);
      this.writeCell(this.position.x, this.position.y, this.position.z, "*");
    } else if (!this.touchingType("H")) {
      const { x: nx, y: ny, z: nz } = next;
      if (nx >= 0 && nx < this.seqW && ny >= 0 && ny < this.seqH && nz >= 0 && nz < this.seqD) {
        this.writeCell(nx, ny, nz, this.type);
      }
      this.clearAt(this.position.x, this.position.y, this.position.z);
    }
  }
}
