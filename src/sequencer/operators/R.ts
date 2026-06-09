import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class R extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    min: "minimum value (inclusive)", max: "maximum value (exclusive)", output: "random value (base-36)",
  };
  override slotDescription(n: string) { return R.SLOT_DESCRIPTIONS[n] ?? null; }

  // Seeded by position so different R cells produce different sequences
  private seed: number;

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "R";
    this.inputs.set("min", vec3(-1, 0, 0));
    this.inputs.set("max", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
    this.seed = x + y * 31 + z * 1009;
  }

  update() {
    super.update();
    if (!this.active) return;

    let min = this.getIntInput("min", 0);
    let max = this.getIntInput("max", 0);
    // BUG FIX: original C# had `max = min` instead of `max = tmp`
    if (min > max) { const tmp = min; min = max; max = tmp; }

    const rand = this._next(min, max);
    this.writeOutput("output", Cell.base36(rand));
  }

  private _next(min: number, max: number): number {
    // Simple seeded LCG so the sequence is deterministic per-cell per-frame
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    if (max <= min) return min;
    return min + (this.seed % (max - min));
  }
}
