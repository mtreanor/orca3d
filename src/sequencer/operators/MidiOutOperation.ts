import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

const NOTES = ["C", "c", "D", "d", "E", "F", "f", "G", "g", "A", "a", "B"];

export class MidiOutOperation extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    channel:  "MIDI channel (0–15)",
    octave:   "octave number",
    note:     "note name: C c D d E F f G g A a B",
    velocity: "velocity (0–35 → 0–127, empty = 100)",
    duration: "duration in sixteenths (empty = 1)",
  };
  override slotDescription(n: string) { return MidiOutOperation.SLOT_DESCRIPTIONS[n] ?? null; }

  constructor(x: number, y: number, z: number) {
    super(x, y, z);
    this.type = ":";
    this.inputs.set("channel",  vec3(1, 0, 0));
    this.inputs.set("octave",   vec3(2, 0, 0));
    this.inputs.set("note",     vec3(3, 0, 0));
    this.inputs.set("velocity", vec3(4, 0, 0));
    this.inputs.set("duration", vec3(5, 0, 0));
  }

  update() {
    super.update();
    if (!this.active) return;
    if (!this.touchingBang()) return;

    const channel = this.getIntInput("channel", 0);
    const octave  = this.getIntInput("octave", 5);

    const noteStr   = this.readValueFromOffset(this.inputs.get("note")!);
    const noteIndex = NOTES.indexOf(noteStr);
    if (noteIndex < 0) return;

    const midiNote = octave * 12 + noteIndex;
    if (midiNote < 0 || midiNote > 127) return;

    const velStr   = this.readValueFromOffset(this.inputs.get("velocity")!);
    // BUG FIX: original C# did integer division `/ 36` which always yielded 0.
    // Correct: map 0-35 linearly to 0-127.
    const velocity = velStr === ""
      ? 100
      : Math.round(Cell.getIntFromString(velStr) / 35 * 127);

    const durStr     = this.readValueFromOffset(this.inputs.get("duration")!);
    const durationMs = durStr === ""
      ? this.seqSixteenth - 10
      : this.seqSixteenth * Cell.getIntFromString(durStr) - 10;

    this.enqueueMidi({ channel, note: midiNote, velocity, durationMs: Math.max(durationMs, 1) });
  }
}
