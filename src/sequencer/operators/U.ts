import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Uclid — euclidean rhythm trigger
export class U extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    step: "onset count", max: "cycle length", star: "trigger on euclidean hit",
  };
  override slotDescription(n: string) { return U.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "U";
    this.inputs.set("step", vec3(-1, 0, 0));
    this.inputs.set("max",  vec3(1, 0, 0));
    this.outputs.set("star", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;
    const step = this.getIntInput("step", 1);
    const max  = this.getIntInput("max", 8);
    const bucket = (step * (this.seqFrame + max - 1)) % max + step;
    if (bucket >= max) this.writeOutput("star", "*");
  }
}
