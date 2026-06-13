import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class C extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    rate: "clock divisor (base-36)", mod: "modulus (empty = no output)", output: "frame counter (base-36)",
  };
  override slotDescription(n: string) { return C.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "C";
    this.inputs.set("rate", vec3(-1, 0, 0));
    this.inputs.set("mod", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const rate = this.getIntInput("rate", 0, 1);
    const mod = this.getIntInput("mod", 0);
    if (mod === 0) return; // Orca: modulo 0 produces no output
    const output = Math.floor(this.seqFrame / rate) % mod;
    this.writeOutput("output", this.sensitiveCase(Cell.base36(output)));
  }
}
