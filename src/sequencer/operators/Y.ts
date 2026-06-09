import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Yumper — passes the cell to the left to the right
export class Y extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    input: "value from the left", output: "passes value rightward",
  };
  override slotDescription(n: string) { return Y.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "Y";
    this.inputs.set("input",   vec3(-1, 0, 0));
    this.outputs.set("output", vec3(1, 0, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const val = this.readValueFromOffset(this.inputs.get("input")!);
    this.writeOutput("output", val);
  }
}
