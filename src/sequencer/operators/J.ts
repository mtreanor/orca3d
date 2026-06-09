import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Jump — passes the cell above down to the output
export class J extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    input: "cell above to copy through", output: "value passed downward",
  };
  override slotDescription(n: string) { return J.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "J";
    this.inputs.set("input", vec3(0, -1, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const val = this.readValueFromOffset(this.inputs.get("input")!);
    this.writeOutput("output", val);
  }
}
