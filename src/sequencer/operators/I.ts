import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Increment — adds step to the current output value each frame, wraps at mod
export class I extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    step: "amount added each frame", mod: "wrap at this value", output: "accumulated counter (base-36)",
  };
  override slotDescription(n: string) { return I.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "I";
    this.inputs.set("step", vec3(-1, 0, 0));
    this.inputs.set("mod", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const step = this.getIntInput("step", 1);
    const mod = this.getIntInput("mod", 1);
    const val = this.getIntOutput("output", 0);
    const output = (val + step) % (mod > 0 ? mod : 36);
    this.writeOutput("output", Cell.base36(output));
  }
}
