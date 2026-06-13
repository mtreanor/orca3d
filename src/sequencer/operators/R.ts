import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class R extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    a: "range bound (inclusive)", b: "range bound (inclusive)", output: "random value (base-36)",
  };
  override slotDescription(n: string) { return R.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "R";
    this.inputs.set("a", vec3(-1, 0, 0));
    this.inputs.set("b", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    // Orca reference: inclusive of both bounds, order-agnostic, a==b → a
    const a = this.getIntInput("a", 0);
    const b = this.getIntInput("b", 0);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const rand = lo === hi ? lo : Math.floor(Math.random() * (hi - lo + 1)) + lo;
    this.writeOutput("output", this.sensitiveCase(Cell.base36(rand)));
  }
}
