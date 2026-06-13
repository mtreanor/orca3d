import { Cell } from "../cell.js";
import { vec3, addVec3, scaleVec3 } from "../vec3.js";

// Table — reads from a table at a key-indexed offset
export class T extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    length: "number of table values", key: "read index (wraps)", output: "value at key index",
  };
  override slotDescription(n: string) {
    if (n.startsWith("t")) return `table value at index ${n.slice(1)}`;
    return T.SLOT_DESCRIPTIONS[n] ?? null;
  }

  private prevLength = 0;

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "T";
    this.inputs.set("length", vec3(-1, 0, 0));
    this.inputs.set("key",    vec3(-2, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  override refreshDynamicInputs(): boolean {
    const length = this.getIntInput("length", 0, 1);
    if (length === this.prevLength) return false;
    const oldLength = this.prevLength;
    this.removeSelfAsDataParent();
    for (let i = length; i < oldLength; i++) {
      const off = this.inputs.get("t" + i);
      if (off) { const p = addVec3(this.position, off); this.writeCell(p.x, p.y, p.z, this.readCell(p.x, p.y, p.z)); }
    }
    for (let i = 0; i < oldLength; i++) this.inputs.delete("t" + i);
    for (let i = 0; i < length; i++) this.inputs.set("t" + i, scaleVec3(this.forward, i + 1));
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
    this.refreshDynamicInputs();
    const length = this.prevLength;
    if (length === 0) return;
    const key   = this.getIntInput("key", 0);
    const index = key % length;
    const output = this.readValueFromOffset(this.inputs.get("t" + index)!);
    this.writeOutput("output", output);
  }
}
