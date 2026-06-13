import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

// Equality — outputs * when left === right
export class F extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    a: "left operand", b: "right operand", star: "* trigger when a equals b",
  };
  override slotDescription(n: string) { return F.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "F";
    this.inputs.set("a", vec3(-1, 0, 0));
    this.inputs.set("b", vec3(1, 0, 0));
    this.outputs.set("star", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const a = this.readValueFromOffset(this.inputs.get("a")!);
    const b = this.readValueFromOffset(this.inputs.get("b")!);
    // Bang port: clears the output cell when the condition is false (Orca bang())
    this.writeOutput("star", a === b ? "*" : "");
  }
}
