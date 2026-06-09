import { Cell } from "../cell.js";
import { vec3, addVec3 } from "../vec3.js";

// Offset read — reads a cell at a relative (x,y,z) offset and copies it to output
export class O extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    x: "X offset to read from", y: "Y offset to read from", z: "Z offset to read from",
    input: "cell at computed offset", output: "value read from offset",
  };
  override slotDescription(n: string) { return O.SLOT_DESCRIPTIONS[n] ?? null; }

  private prevX = -1;
  private prevY = -1;
  private prevZ = -1;
  private prevOut = "";

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "O";
    this.inputs.set("x",     vec3(-3, 0, 0));
    this.inputs.set("y",     vec3(-2, 0, 0));
    this.inputs.set("z",     vec3(-1, 0, 0));
    this.inputs.set("input", vec3(1, 0, 0));
    this.outputs.set("output", vec3(0, 1, 0));
  }

  update() {
    super.update();
    if (!this.active) return;

    const x = this.getIntInput("x", 0);
    const y = this.getIntInput("y", 0);
    const z = this.getIntInput("z", 0);

    // Read the cell at (position + offset + (1,0,0)) — matches the C# offset.x += 1 pattern
    const readPos = addVec3(addVec3(this.position, vec3(x, y, z)), vec3(1, 0, 0));
    const output  = this.readCell(readPos.x, readPos.y, readPos.z);

    if (x !== this.prevX || y !== this.prevY || z !== this.prevZ || output !== this.prevOut) {
      this.removeSelfAsDataParent();
      this.inputs.set("input", vec3(x + 1, y, z));
      this.addSelfAsDataParent();
      this.writeOutput("output", output);
    }

    this.prevX = x; this.prevY = y; this.prevZ = z; this.prevOut = output;
  }
}
