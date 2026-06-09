import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class A extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    a: "first addend", b: "second addend", output: "sum (base-36)",
  };
  override slotDescription(n: string) { return A.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "A";
    this.inputs.set("a", vec3(-1, 0, 0));
    this.inputs.set("b", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const a = this.getIntInput("a", 0);
    const b = this.getIntInput("b", 0);
    this.writeOutput("output", Cell.base36(a + b));
  }
}
