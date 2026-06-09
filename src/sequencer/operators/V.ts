import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Variable — set (left=name, right=value) or get (left empty, right=name, outputs value below)
export class V extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    left:   "variable name (write mode) or empty (read mode)",
    right:  "value to store (write) or variable name to read",
    output: "variable value (read mode only)",
  };
  override slotDescription(n: string) { return V.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "V";
    this.inputs.set("left",  vec3(-1, 0, 0));
    this.inputs.set("right", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const left  = this.readValueFromOffset(this.inputs.get("left")!);
    const right = this.readValueFromOffset(this.inputs.get("right")!);

    if (left === "" && right !== "") {
      // Read mode
      const val = this.seqVariables.get(right) ?? "";
      this.writeOutput("output", val);
    } else if (left !== "") {
      // Write mode
      this.seqVariables.set(left, right);
    }
  }
}
