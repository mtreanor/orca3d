import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

export class CCOperation extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    channel: "MIDI channel (0–15)", knob: "CC number", value: "CC value (0–35 → 0–127)",
  };
  override slotDescription(n: string) { return CCOperation.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = "!";
    this.inputs.set("channel", vec3(1, 0, 0));
    this.inputs.set("knob",    vec3(2, 0, 0)); // BUG FIX: original C# read "channel" for knob
    this.inputs.set("value",   vec3(3, 0, 0));
  }

  update() {
    super.update();
    if (!this.active) return;
    if (!this.touchingBang()) return;

    // Orca requires channel and knob; an empty value reads as 0
    const channel = this.getIntInput("channel", -1);
    const knob    = this.getIntInput("knob", -1);
    if (channel < 0 || channel > 15 || knob < 0) return;

    const rawValue = this.getIntInput("value", 0, 0);
    const val = Math.ceil((127 * rawValue) / 35);
    this.enqueueMidi({ channel, note: knob, velocity: val, durationMs: 0 });
  }
}
