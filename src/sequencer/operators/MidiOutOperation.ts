import { Cell } from "../cell.js";
import { vec3 } from "../vec3.js";

const CHROMATIC = ["C", "c", "D", "d", "E", "F", "f", "G", "g", "A", "a", "B"];

// Orca's transpose table: every letter maps to a base note plus an octave
// offset, so table-driven melodies can use the full a–z range (J = C an
// octave up, etc.). Uppercase = natural, lowercase = sharp.
const TRANSPOSE: Record<string, string> = {
  A: "A0", a: "a0", B: "B0", C: "C0", c: "c0", D: "D0", d: "d0", E: "E0",
  F: "F0", f: "f0", G: "G0", g: "g0", H: "A0", h: "a0", I: "B0", J: "C1",
  j: "c1", K: "D1", k: "d1", L: "E1", M: "F1", m: "f1", N: "G1", n: "g1",
  O: "A1", o: "a1", P: "B1", Q: "C2", q: "c2", R: "D2", r: "d2", S: "E2",
  T: "F2", t: "f2", U: "G2", u: "g2", V: "A2", v: "a2", W: "B2", X: "C3",
  x: "c3", Y: "D3", y: "d3", Z: "E3",
  e: "F0", l: "F1", s: "F2", z: "F3",
  b: "C1", i: "C1", p: "C2", w: "C3",
};

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

export class MidiOutOperation extends Cell {
  static SLOT_DESCRIPTIONS: Record<string, string> = {
    channel:  "MIDI channel (0–15, required)",
    octave:   "octave (0–8, required)",
    note:     "note letter (required) — uppercase natural, lowercase sharp; H–Z transpose upward",
    velocity: "velocity (0–16 → 0–127, empty = f)",
    duration: "duration in sixteenths (0–32, empty = 1)",
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

    // Orca refuses to fire when channel, octave, or note is missing
    const channelStr = this.readValueFromOffset(this.inputs.get("channel")!);
    const octaveStr  = this.readValueFromOffset(this.inputs.get("octave")!);
    const noteStr    = this.readValueFromOffset(this.inputs.get("note")!);
    if (channelStr === "" || octaveStr === "" || noteStr === "") return;

    const channel = this.getIntInput("channel", 0);
    if (channel > 15) return;
    const octave = this.getIntInput("octave", 0, 0, 8);

    const t = TRANSPOSE[noteStr];
    if (!t) return; // digits and unknown glyphs are not notes
    const noteOctave = clamp(octave + parseInt(t.charAt(1), 10), 0, 8);
    // Orca pitch mapping: id = octave*12 + chromatic index + 24
    const midiNote = clamp(noteOctave * 12 + CHROMATIC.indexOf(t.charAt(0)) + 24, 0, 127);

    // Orca velocity: 0–16 scale (default f = 15) mapped onto 0–127
    const velRaw = this.getIntInput("velocity", 15, 0, 16);
    const velocity = Math.floor((velRaw / 16) * 127);

    const duration = this.getIntInput("duration", 1, 0, 32);
    const durationMs = Math.max(this.seqSixteenth * duration - 10, 1);

    this.enqueueMidi({ channel, note: midiNote, velocity, durationMs });
  }
}
