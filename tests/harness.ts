// Headless patch harness — runs the sequencer engine without the renderer.
// Patches are Orca-style text blocks ('.' = empty cell) loaded onto plane z=0,
// so behavior can be asserted (and bugs iterated on) straight from Node:
//
//   npx tsx tests/semantics.ts
//
import { Sequencer, MidiEvent } from "../src/sequencer/sequencer.js";

export interface PatchRun {
  seq: Sequencer;
  /** MIDI events drained so far, tagged with the tick they fired on (1-based). */
  events: (MidiEvent & { tick: number })[];
  /** Advance n ticks (default 1), draining MIDI after each. */
  tick(n?: number): void;
  /** Glyph at a cell, "" when empty. */
  at(x: number, y: number, z?: number): string;
  /** Snapshot of a z-plane as Orca-style text (for 2D debugging). */
  text(z?: number): string;
  /** Rotate the operator at (x,y,z) n quarter-turns CW around Y (default 1). */
  rotate(x: number, y: number, z: number, n?: number): void;
  /** Absolute grid position of a named input slot, or null if the slot doesn't exist. */
  slotPos(x: number, y: number, z: number, slotName: string): { x: number; y: number; z: number } | null;
}

// ─── Text-patch loader (2D, z=0) ────────────────────────────────────────────

export function runPatch(patch: string, ticks = 0): PatchRun {
  const lines = patch.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const h = lines.length;
  const w = Math.max(...lines.map(l => l.length));
  const seq = new Sequencer(Math.max(24, w), Math.max(24, h + 8), 5);
  lines.forEach((line, y) =>
    [...line].forEach((ch, x) => { if (ch !== ".") seq.modifyCell(x, y, 0, ch); }));

  const run = _makeRun(seq, h, w);
  run.tick(ticks);
  return run;
}

// ─── 3D builder ─────────────────────────────────────────────────────────────

export interface PatchBuilder {
  seq: Sequencer;
  /** Place a glyph at an absolute grid position. */
  place(x: number, y: number, z: number, glyph: string): PatchBuilder;
  /** Rotate the operator at (x,y,z) n quarter-turns CW around Y axis (default 1).
   *  Call AFTER placing the operator, BEFORE placing its argument values.
   *  CW turns: rot=1 → forward +X→+Z, rot=2 → +X→-X, rot=3 → +X→-Z. */
  rotate(x: number, y: number, z: number, n?: number): PatchBuilder;
  /** Absolute grid position of a named input slot on an operator, or null if the slot doesn't exist. */
  slotPos(x: number, y: number, z: number, slotName: string): { x: number; y: number; z: number } | null;
  /** Advance n ticks and return a PatchRun for assertions. */
  run(ticks?: number): PatchRun;
}

export function buildPatch(w = 24, h = 24, d = 5): PatchBuilder {
  const seq = new Sequencer(w, h, d);

  const rotateOp = (x: number, y: number, z: number, n = 1) => {
    for (let i = 0; i < n; i++) seq.rotateOperator(x, y, z, "Y_NEG");
  };

  const slotPosImpl = (x: number, y: number, z: number, slotName: string) => {
    const offset = seq.getCell(x, y, z).inputs.get(slotName);
    if (!offset) return null;
    return { x: x + offset.x, y: y + offset.y, z: z + offset.z };
  };

  const builder: PatchBuilder = {
    seq,
    place(x, y, z, glyph) { seq.modifyCell(x, y, z, glyph); return builder; },
    rotate(x, y, z, n = 1) { rotateOp(x, y, z, n); return builder; },
    slotPos: slotPosImpl,
    run(ticks = 0) {
      const run = _makeRun(seq, h, w);
      run.tick(ticks);
      return run;
    },
  };

  return builder;
}

// ─── Shared run factory ──────────────────────────────────────────────────────

function _makeRun(seq: Sequencer, patchH: number, patchW: number): PatchRun {
  const events: PatchRun["events"] = [];
  let t = 0;

  const run: PatchRun = {
    seq,
    events,
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        t++;
        seq.tick();
        for (const e of seq.drainMidi()) events.push({ ...e, tick: t });
      }
    },
    at: (x, y, z = 0) => seq.getCell(x, y, z).value,
    text(z = 0) {
      let out = "";
      for (let y = 0; y < patchH; y++) {
        for (let x = 0; x < patchW; x++) {
          const v = seq.getCell(x, y, z).value;
          out += v === "" ? "." : v;
        }
        out += "\n";
      }
      return out.trimEnd();
    },
    rotate(x, y, z, n = 1) {
      for (let i = 0; i < n; i++) seq.rotateOperator(x, y, z, "Y_NEG");
    },
    slotPos(x, y, z, slotName) {
      const offset = seq.getCell(x, y, z).inputs.get(slotName);
      if (!offset) return null;
      return { x: x + offset.x, y: y + offset.y, z: z + offset.z };
    },
  };

  return run;
}

// ─── Minimal assertion helpers ───────────────────────────────────────────────

let pass = 0;
let fail = 0;

export function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

export function summary(): never {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
