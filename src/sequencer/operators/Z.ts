import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Slew / glide — moves current output value toward target at rate
export class Z extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    rate: "slew speed (steps per frame)", target: "destination value", output: "interpolated value (base-36)",
  };
  override slotDescription(n: string) { return Z.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "Z";
    this.inputs.set("rate",   vec3(-1, 0, 0));
    this.inputs.set("target", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const rate   = this.getIntInput("rate", 0);
    const target = this.getIntInput("target", 0);
    const val    = this.getIntOutput("output", 0);

    // Straight from Orca source (empty rate = 0 = frozen, as in the reference)
    const mod    = val <= target - rate ? rate : val >= target + rate ? -rate : target - val;
    this.writeOutput("output", this.sensitiveCase(Cell.base36(val + mod)));
  }
}
