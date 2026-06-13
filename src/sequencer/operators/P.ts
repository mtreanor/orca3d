import { Cell } from "../cell.js";
import { vec3, addVec3 } from "../vec3.js";

// Distribute — sends input to the key-indexed output slot in a table below
export class P extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    length: "table width", key: "destination index", input: "value to distribute",
  };
  override slotDescription(n: string) {
    if (n.startsWith("t")) return `output slot at index ${n.slice(1)}`;
    return P.SLOT_DESCRIPTIONS[n] ?? null;
  }

  private prevInput = "";
  private prevLength = -1;
  private prevKey = -1;

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "P";
    this.inputs.set("length", vec3(-1, 0, 0));
    this.inputs.set("key",    vec3(-2, 0, 0));
    this.inputs.set("input",  vec3(1, 0, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const key    = this.getIntInput("key", 0);
    const length = this.getIntInput("length", 0, 1);
    const input  = this.readValueFromOffset(this.inputs.get("input")!);
    const safeKey = key % length;

    if (length !== this.prevLength) {
      this.removeSelfAsDataParent();
      for (let i = 0; i < this.prevLength; i++) this.outputs.delete("t" + i);
      for (let i = 0; i < length; i++) {
        // Output positions: x=i, y=1 (below), z=0 — matches the C# `outputPos.x = i` override
        this.outputs.set("t" + i, vec3(i, 1, 0));
      }
      this.addSelfAsDataParent();
    }

    if (input !== this.prevInput || safeKey !== this.prevKey) {
      const outKey = "t" + safeKey;
      if (this.outputs.has(outKey)) {
        const p = addVec3(this.position, this.outputs.get(outKey)!);
        this.writeCell(p.x, p.y, p.z, input);
      }
    }

    this.prevLength = length;
    this.prevKey    = safeKey;
    this.prevInput  = input;
  }
}
