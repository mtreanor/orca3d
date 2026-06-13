import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Multiply
export class M extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    a: "first factor", b: "second factor", output: "a × b (base-36)",
  };
  override slotDescription(n: string) { return M.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "M";
    this.inputs.set("a", vec3(-1, 0, 0));
    this.inputs.set("b", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const a = this.getIntInput("a", 0);
    const b = this.getIntInput("b", 0);
    this.writeOutput("output", this.sensitiveCase(Cell.base36(a * b)));
  }
}
