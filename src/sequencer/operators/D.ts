import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class D extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    rate: "interval multiplier (default 1)", mod: "cycle length (default 1, 1 = every frame)", star: "trigger pulse output",
  };
  override slotDescription(n: string) { return D.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "D";
    this.inputs.set("rate", vec3(-1, 0, 0));
    this.inputs.set("mod", vec3(1, 0, 0));
    this.outputs.set("star", vec3(0, 1, 0));
  }
  update() {
    super.update();
    if (!this.active) return;
    const rate = this.getIntInput("rate", 0, 1);
    const mod = this.getIntInput("mod", 0, 1);
    // Bang port: writes * when firing and clears the cell otherwise, exactly
    // like Orca's bang() — this is what consumes leftover stars between fires.
    const fire = this.seqFrame % (mod * rate) === 0 || mod === 1;
    this.writeOutput("star", fire ? "*" : "");
  }
}
