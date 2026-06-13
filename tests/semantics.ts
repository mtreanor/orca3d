// Orca-compatibility semantics checks. Each patch is laid out exactly as it
// would be written in original Orca, on plane z=0.
import { runPatch, check, summary } from "./harness.js";

// --- Bang lifecycle: D8 banging a `:` (same-frame, once per fire) ---
{
  const r = runPatch(`
    .....D8...
    ......:04C
  `, 24);
  check("D8 fires on frames 8,16,24 exactly",
    r.events.map(e => e.tick).join(",") === "8,16,24",
    `got [${r.events.map(e => e.tick).join(",")}]`);
  check(":04C plays MIDI 72 (Orca pitch map)", r.events[0]?.note === 72, `got ${r.events[0]?.note}`);
  check("default velocity is f → 119", r.events[0]?.velocity === 119, `got ${r.events[0]?.velocity}`);
}

// --- Sensitive output: uppercase east operand uppercases the result ---
{
  const r = runPatch(`2AB`, 1);
  check("A with uppercase operand outputs uppercase", r.at(1, 1) === "D", `got '${r.at(1, 1)}'`);
  const r2 = runPatch(`2Ab`, 1);
  check("A with lowercase operand outputs lowercase", r2.at(1, 1) === "d", `got '${r2.at(1, 1)}'`);
}

// --- X slot layout: Orca positions (x at -2, y at -1), empty z = same plane ---
{
  const r = runPatch(`.23X5`, 1);
  check("X writes value at (x, y+1) like Orca", r.at(5, 4) === "5", `got '${r.at(5, 4)}' at (5,4)`);
}

// --- Movers: wall explosion, travel, banged lowercase hop ---
{
  const r = runPatch(".".repeat(23) + "E", 1);
  check("E at east wall explodes into *", r.at(23, 0) === "*", `got '${r.at(23, 0)}'`);
  r.tick();
  check("explosion star erases next frame", r.at(23, 0) === "", `got '${r.at(23, 0)}'`);

  const r2 = runPatch(`E...`, 2);
  check("E travels one cell per frame", r2.text() === "..E.", `got '${r2.text()}'`);

  const r3 = runPatch(`
    e
    *
  `, 1);
  check("banged e hops east as lowercase", r3.at(1, 0) === "e" && r3.at(0, 0) === "",
    `(1,0)='${r3.at(1, 0)}' (0,0)='${r3.at(0, 0)}'`);
  r3.tick();
  check("hopped e waits for the next bang", r3.at(1, 0) === "e", `got '${r3.at(1, 0)}'`);
}

// --- H halts the operator below ---
{
  const r = runPatch(`
    H
    D
  `, 4);
  check("D below H never bangs", r.at(0, 2) === "", `got '${r.at(0, 2)}'`);

  const r2 = runPatch(`D`, 1);
  check("D with empty mod bangs every frame", r2.at(0, 1) === "*", `got '${r2.at(0, 1)}'`);

  const r3 = runPatch(`
    H
    *
  `, 3);
  check("star below H persists and keeps banging", r3.at(0, 1) === "*", `got '${r3.at(0, 1)}'`);
}

// --- C: empty mod is silent, C4 counts frames ---
{
  const r = runPatch(`C....C4`, 3);
  check("C with empty mod stays silent", r.at(0, 1) === "", `got '${r.at(0, 1)}'`);
  check("C4 outputs frame % 4", r.at(5, 1) === "3", `got '${r.at(5, 1)}'`);
}

// --- `:` guards and pitch table ---
{
  const r = runPatch(`
    D....
    .:0..
  `, 2);
  check(": without octave/note is silent", r.events.length === 0, `got ${r.events.length} events`);

  const r2 = runPatch(`
    D....
    .:00C
  `, 1);
  check(":00C plays MIDI 24 (octave 0 is reachable)", r2.events[0]?.note === 24, `got ${r2.events[0]?.note}`);

  const r3 = runPatch(`
    D....
    .:03J
  `, 1);
  check(":03J plays MIDI 72 (J transposes to C+1 octave)", r3.events[0]?.note === 72, `got ${r3.events[0]?.note}`);
}

// --- R: inclusive bounds ---
{
  const r = runPatch(`5R5`, 1);
  check("R with a==b outputs a", r.at(1, 1) === "5", `got '${r.at(1, 1)}'`);

  const r2 = runPatch(`.R1`, 0);
  const seen = new Set<string>();
  for (let t = 0; t < 50; t++) { r2.tick(); seen.add(r2.at(1, 1)); }
  check("R 0..1 hits both bounds (inclusive)", seen.has("0") && seen.has("1"),
    `saw {${[...seen].join(",")}}`);
}

summary();
