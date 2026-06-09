import { Cell } from "../cell.js";
import { vec3, scaleVec3, addVec3 } from "../vec3.js";

// Variable lookup table — reads keys from input row, looks them up in variables dict, writes values below
export class K extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    length: "number of variable keys to look up",
  };
  override slotDescription(n: string) {
    if (n.startsWith("t")) return `variable name at index ${n.slice(1)}`;
    return K.SLOT_DESCRIPTIONS[n] ?? null;
  }

  private prevLength = -1;
  private prevInputs: Map<string, string> = new Map();
  private prevVarValues: Map<string, string> = new Map();

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "K";
    this.inputs.set("length", vec3(-1, 0, 0));
  }

  override refreshDynamicInputs(): boolean {
    const length = this.getIntInput("length", 1);
    if (length === this.prevLength) return false;
    const oldLength = this.prevLength;
    this.removeSelfAsDataParent();
    for (let i = length; i < oldLength; i++) {
      const off = this.inputs.get("t" + i);
      if (off) { const p = addVec3(this.position, off); this.writeCell(p.x, p.y, p.z, this.readCell(p.x, p.y, p.z)); }
    }
    for (let i = 0; i < oldLength; i++) { this.inputs.delete("t" + i); this.outputs.delete("t" + i); }
    for (let i = 0; i < length; i++) {
      this.inputs.set("t" + i, scaleVec3(this.forward, i + 1));
      this.outputs.set("t" + i, addVec3(this.DOWN, scaleVec3(this.forward, i + 1)));
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

    const length = this.getIntInput("length", 1);
    this.refreshDynamicInputs();

    if (this._changed()) {
      this.removeSelfAsDataParent();
      for (let i = 0; i < length; i++) {
        const key = "t" + i;
        if (!this.inputs.has(key)) continue;
        const varName = this.readValueFromOffset(this.inputs.get(key)!);
        // Output position is offset (i+1, 1, 0) relative to operator
        this.outputs.set(key, vec3(i + 1, 1, 0));
        const varVal = this.seqVariables.get(varName) ?? "";
        if (varVal !== "") {
          const p = addVec3(this.position, this.outputs.get(key)!);
          this.writeCell(p.x, p.y, p.z, varVal);
        }
      }
      this.addSelfAsDataParent();
    }

    // Track previous state
    this.prevInputs.clear();
    this.prevVarValues.clear();
    for (let i = 0; i < length; i++) {
      const key = "t" + i;
      if (!this.inputs.has(key)) continue;
      const val = this.readValueFromOffset(this.inputs.get(key)!);
      this.prevInputs.set(key, val);
      this.prevVarValues.set(key, this.seqVariables.get(val) ?? "");
    }
  }

  private _changed(): boolean {
    for (const [key, offset] of this.inputs.entries()) {
      if (!key.startsWith("t")) continue;
      const cur = this.readValueFromOffset(offset);
      const prev = this.prevInputs.get(key) ?? "";
      if (cur !== prev) return true;
      const curVar = this.seqVariables.get(cur) ?? "";
      const prevVar = this.prevVarValues.get(key) ?? "";
      if (curVar !== prevVar) return true;
    }
    return false;
  }
}
