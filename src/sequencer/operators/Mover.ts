import { Cell } from "../cell.js";
import { Vec3, addVec3, rotateVector90, RotateDir } from "../vec3.js";

export class Mover extends Cell {
  direction: Vec3 = { x: 1, y: 0, z: 0 };

  override rotate(dir: RotateDir) {
    super.rotate(dir);
    this.direction = rotateVector90(this.direction, dir);
  }

  override reorient(fwdX: number, fwdZ: number) {
    const oldFwd = { ...this.forward };
    super.reorient(fwdX, fwdZ);
    // Apply the same Y_NEG rotations to direction that reorient applied to forward
    let f = { ...oldFwd };
    let d = { ...this.direction };
    for (let i = 0; i < 4 && (f.x !== this.forward.x || f.z !== this.forward.z); i++) {
      f = rotateVector90(f, "Y_NEG");
      d = rotateVector90(d, "Y_NEG");
    }
    this.direction = d;
  }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "Mover";
  }

  move() {
    // tempCell movers are banged lowercase glyphs activated this tick — they
    // must hop immediately (Orca: a banged `e` moves the frame it's banged).
    if (this.justCreated() && !this.tempCell) return;
    const { x: nx, y: ny, z: nz } = addVec3(this.position, this.direction);
    const outOfBounds =
      nx < 0 || nx >= this.seqW || ny < 0 || ny >= this.seqH || nz < 0 || nz >= this.seqD;

    if (outOfBounds || this.readCell(nx, ny, nz) !== "") {
      // Orca: blocked movers explode into a bang at their own position
      this.clearAt(this.position.x, this.position.y, this.position.z);
      this.writeCell(this.position.x, this.position.y, this.position.z, "*");
      return;
    }

    // A banged lowercase mover hops once and stays lowercase (Orca semantics)
    // instead of becoming a permanent uppercase mover.
    if (this.tempCell) {
      this.writeCell(nx, ny, nz, this.type.toLowerCase());
    } else {
      this.writeCell(nx, ny, nz, this.type);
      this.reorientAt(nx, ny, nz, this.forward.x, this.forward.z);
    }
    this.clearAt(this.position.x, this.position.y, this.position.z);
  }
}
