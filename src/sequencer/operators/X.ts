import { Cell } from "../cell.js";
import { vec3, addVec3 } from "../vec3.js";

// Write — copies a value to an absolute-offset position
export class X extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    x: "target X offset", y: "target Y offset", z: "target Z offset",
    value: "value to write", output: "target cell",
  };
  override slotDescription(n: string) { return X.SLOT_DESCRIPTIONS[n] ?? null; }

  private prevX = -1;
  private prevY = -1;
  private prevZ = -1;
  private prevVal = "";

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "X";
    this.inputs.set("x",     vec3(-3, 0, 0));
    this.inputs.set("y",     vec3(-2, 0, 0));
    this.inputs.set("z",     vec3(-1, 0, 0));
    this.inputs.set("value", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const x   = this.getIntInput("x", 0);
    const y   = this.getIntInput("y", 0);
    const z   = this.getIntInput("z", 0);
    const val = this.readValueFromOffset(this.inputs.get("value")!);

    if (x !== this.prevX || y !== this.prevY || z !== this.prevZ || val !== this.prevVal) {
      this.removeSelfAsDataParent();
      // Output offset is (x, y+1, z) relative to operator — matches C# `new Vector3Int(x, y + 1, z)`
      this.outputs.set("output", vec3(x, y + 1, z));
      this.addSelfAsDataParent();

      const p = addVec3(this.position, this.outputs.get("output")!);
      this.writeCell(p.x, p.y, p.z, val);
    }

    this.prevX = x; this.prevY = y; this.prevZ = z; this.prevVal = val;
  }
}
