import { Cell } from "../cell.js";
import { vec3, addVec3, scaleVec3 } from "../vec3.js";

// Grid scatter: reads a table of inputs (right side) and copies them to a grid offset
export class G extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    x: "target X offset", y: "target Y offset", z: "target Z offset", length: "table length",
  };
  override slotDescription(n: string) {
    if (n.startsWith("t")) return `table value at index ${n.slice(1)}`;
    return G.SLOT_DESCRIPTIONS[n] ?? null;
  }

  private prevLength = -1;
  private prevX = -1;
  private prevY = -1;
  private prevZ = -1;
  private prevTableValues: Map<string, string> = new Map();

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "G";
    this.inputs.set("x", vec3(-4, 0, 0));
    this.inputs.set("y", vec3(-3, 0, 0));
    this.inputs.set("z", vec3(-2, 0, 0));
    this.inputs.set("length", vec3(-1, 0, 0));
  }

  override refreshDynamicInputs(): boolean {
    const length = this.getIntInput("length", 1);
    if (length === this.prevLength) return false;
    const oldLength = this.prevLength;
    const x = this.getIntInput("x", 0);
    const y = this.getIntInput("y", 0);
    const z = this.getIntInput("z", 0);
    this.removeSelfAsDataParent();
    for (let i = length; i < oldLength; i++) {
      const off = this.inputs.get("t" + i);
      if (off) { const p = addVec3(this.position, off); this.writeCell(p.x, p.y, p.z, this.readCell(p.x, p.y, p.z)); }
    }
    for (let i = 0; i < oldLength; i++) { this.inputs.delete("t" + i); this.outputs.delete("t" + i); }
    for (let i = 0; i < length; i++) {
      this.inputs.set("t" + i, scaleVec3(this.forward, i + 1));
      this.outputs.set("t" + i, addVec3(vec3(x, y, z), addVec3(this.DOWN, scaleVec3(this.forward, i))));
    }
    this.addSelfAsDataParent();
    this.prevLength = length;
    for (let i = oldLength; i < length; i++) {
      const off = this.inputs.get("t" + i)!;
      const p = addVec3(this.position, off); this.writeCell(p.x, p.y, p.z, this.readCell(p.x, p.y, p.z));
    }
    return true;
  }

  update() {
    super.update();
    if (!this.active) return;

    const x = this.getIntInput("x", 0);
    const y = this.getIntInput("y", 0);
    const z = this.getIntInput("z", 0);
    const length = this.getIntInput("length", 1);

    this.refreshDynamicInputs();

    if (x !== this.prevX || y !== this.prevY || z !== this.prevZ || this._tableChanged()) {
      this.removeSelfAsDataParent();
      for (let i = 0; i < length; i++) {
        const key = "t" + i;
        this.outputs.set(key, vec3(x + i, y + 1, z));
      }
      this.addSelfAsDataParent();

      for (let i = 0; i < length; i++) {
        const key = "t" + i;
        const val = this.readValueFromOffset(this.inputs.get(key)!);
        const outOffset = this.outputs.get(key)!;
        const p = addVec3(this.position, outOffset);
        this.writeCell(p.x, p.y, p.z, val);
      }
    }

    // Track previous state
    for (let i = 0; i < length; i++) {
      const key = "t" + i;
      if (this.inputs.has(key)) {
        this.prevTableValues.set(key, this.readValueFromOffset(this.inputs.get(key)!));
      }
    }
    this.prevX = x;
    this.prevY = y;
    this.prevZ = z;
  }

  private _tableChanged(): boolean {
    for (const [key, offset] of this.inputs.entries()) {
      if (!key.startsWith("t")) continue;
      const cur = this.readValueFromOffset(offset);
      if (cur !== (this.prevTableValues.get(key) ?? "")) return true;
    }
    return false;
  }
}
