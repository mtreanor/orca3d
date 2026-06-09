import { Cell } from "../cell.js";
import { vec3, addVec3, scaleVec3 } from "../vec3.js";

// Query — reads a table at an offset position and copies it to a row below
export class Q extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    x: "source X offset", y: "source Y offset", z: "source Z offset", length: "cells to read",
  };
  override slotDescription(n: string) {
    if (n.startsWith("t")) return `source cell at index ${n.slice(1)}`;
    return Q.SLOT_DESCRIPTIONS[n] ?? null;
  }

  private prevLength = -1;
  private prevX = -1;
  private prevY = -1;
  private prevZ = -1;
  private prevInputs: Map<string, string> = new Map();

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "Q";
    this.inputs.set("x",      vec3(-4, 0, 0));
    this.inputs.set("y",      vec3(-3, 0, 0));
    this.inputs.set("z",      vec3(-2, 0, 0));
    this.inputs.set("length", vec3(-1, 0, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const x      = this.getIntInput("x", 0);
    const y      = this.getIntInput("y", 0);
    const z      = this.getIntInput("z", 0);
    const length = this.getIntInput("length", 1);
    const offset = vec3(x, y, z);

    if (length !== this.prevLength) {
      this.removeSelfAsDataParent();
      for (let i = 0; i < this.prevLength; i++) {
        this.inputs.delete("t" + i);
        this.outputs.delete("t" + i);
      }
      for (let i = 0; i < length; i++) {
        this.inputs.set("t" + i, addVec3(offset, scaleVec3(this.forward, i + 1)));
        // Output row: x offset = -(length-1)+i, y=1
        this.outputs.set("t" + i, vec3(-(length - 1) + i, 1, 0));
      }
      this.addSelfAsDataParent();
    }

    if (x !== this.prevX || y !== this.prevY || z !== this.prevZ || this._changed()) {
      this.removeSelfAsDataParent();
      const newInputs = new Map<string, string>();
      for (let i = 0; i < length; i++) {
        const key = "t" + i;
        const newOffset = addVec3(offset, scaleVec3(this.forward, i + 1));
        this.inputs.set(key, newOffset);
        newInputs.set(key, this.readValueFromOffset(newOffset));
      }
      this.addSelfAsDataParent();

      for (let i = 0; i < length; i++) {
        const key = "t" + i;
        const val = newInputs.get(key) ?? "";
        const outOffset = this.outputs.get(key)!;
        const p = addVec3(this.position, outOffset);
        this.writeCell(p.x, p.y, p.z, val);
      }

      this.prevInputs.clear();
      for (const [k, v] of newInputs) this.prevInputs.set(k, v);
    }

    this.prevLength = length;
    this.prevX = x; this.prevY = y; this.prevZ = z;
  }

  private _changed(): boolean {
    for (const [key, offset] of this.inputs.entries()) {
      if (!key.startsWith("t")) continue;
      const cur  = this.readValueFromOffset(offset);
      const prev = this.prevInputs.get(key) ?? "";
      if (cur !== prev) return true;
    }
    return false;
  }
}
