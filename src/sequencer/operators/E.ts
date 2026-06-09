import { Mover } from "./Mover.js";
import { vec3 } from "../vec3.js";

export class E extends Mover {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "E";
    this.direction = vec3(1, 0, 0);
  }
  update() { super.update(); if (!this.active) return; this.move(); }
}
