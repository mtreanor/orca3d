// 3D-specific rotation and multi-plane tests.
// Run with:  npx tsx tests/3d.ts
import { buildPatch, check, summary } from "./harness.js";

// ─── Rotation reference ──────────────────────────────────────────────────────
// CW around Y (Y_NEG): forward +X → +Z → -X → -Z → +X
//   rot=0  forward=(+1,0, 0)  [default, same as 2D Orca]
//   rot=1  forward=( 0,0,+1)  [into the screen / +Z]
//   rot=2  forward=(-1,0, 0)  [west-facing]
//   rot=3  forward=( 0,0,-1)  [out of the screen / -Z]
// Output is always (0,+1,0) — one cell south — regardless of rotation.

// ─── slotPos reflects rotation ───────────────────────────────────────────────
{
  // A default: a=(-1,0,0), b=(+1,0,0)
  const b = buildPatch();
  b.place(5, 5, 2, "A");

  check("A slot a default is at (-1,0,0) relative",
    (() => { const p = b.slotPos(5, 5, 2, "a"); return p?.x === 4 && p?.y === 5 && p?.z === 2; })(),
    `got ${JSON.stringify(b.slotPos(5, 5, 2, "a"))}`);

  b.rotate(5, 5, 2, 1); // rot=1: a→(0,0,-1), b→(0,0,+1)
  check("A rot=1: slot a moves to (0,0,-1) relative → abs (5,5,1)",
    (() => { const p = b.slotPos(5, 5, 2, "a"); return p?.x === 5 && p?.y === 5 && p?.z === 1; })(),
    `got ${JSON.stringify(b.slotPos(5, 5, 2, "a"))}`);
  check("A rot=1: slot b moves to (0,0,+1) relative → abs (5,5,3)",
    (() => { const p = b.slotPos(5, 5, 2, "b"); return p?.x === 5 && p?.y === 5 && p?.z === 3; })(),
    `got ${JSON.stringify(b.slotPos(5, 5, 2, "b"))}`);

  b.rotate(5, 5, 2, 1); // rot=2: a→(+1,0,0), b→(-1,0,0)
  check("A rot=2: slot a moves to (+1,0,0) relative → abs (6,5,2)",
    (() => { const p = b.slotPos(5, 5, 2, "a"); return p?.x === 6 && p?.y === 5 && p?.z === 2; })(),
    `got ${JSON.stringify(b.slotPos(5, 5, 2, "a"))}`);
  check("A rot=2: slot b moves to (-1,0,0) relative → abs (4,5,2)",
    (() => { const p = b.slotPos(5, 5, 2, "b"); return p?.x === 4 && p?.y === 5 && p?.z === 2; })(),
    `got ${JSON.stringify(b.slotPos(5, 5, 2, "b"))}`);
}

// ─── Rotated A reads from Z axis ─────────────────────────────────────────────
{
  // A rot=1: reads a from z-1, b from z+1. Output always at y+1.
  // sensitiveCase looks along forward=(0,0,+1) → the b-slot cell.
  // If b is uppercase → output is uppercase.
  const b = buildPatch();
  b.place(5, 5, 2, "A");
  b.rotate(5, 5, 2, 1);
  // Place args at rotated slot positions
  b.place(5, 5, 1, "3"); // a = 3
  b.place(5, 5, 3, "B"); // b = 11 (B), uppercase → uppercase output
  const r = b.run(1);
  // 3 + 11 = 14 = "e" → uppercase "E" (because B is uppercase)
  check("rotated A (rot=1) reads Z-axis inputs and produces uppercase output",
    r.at(5, 6, 2) === "E",
    `got '${r.at(5, 6, 2)}'`);

  // Same setup, lowercase b → lowercase output
  const b2 = buildPatch();
  b2.place(5, 5, 2, "A");
  b2.rotate(5, 5, 2, 1);
  b2.place(5, 5, 1, "3"); // a = 3
  b2.place(5, 5, 3, "b"); // b = 11 (b), lowercase → lowercase output
  const r2 = b2.run(1);
  check("rotated A (rot=1) with lowercase b produces lowercase output",
    r2.at(5, 6, 2) === "e",
    `got '${r2.at(5, 6, 2)}'`);
}

// ─── Output is always DOWN regardless of rotation ────────────────────────────
{
  // A at 180° rotation: reads a from (+1,0,0), b from (-1,0,0)
  // Output must still land at (x, y+1, z)
  const b = buildPatch();
  b.place(5, 5, 2, "A");
  b.rotate(5, 5, 2, 2); // rot=2: forward=-X
  const aSlot = b.slotPos(5, 5, 2, "a")!; // (6,5,2)
  const bSlot = b.slotPos(5, 5, 2, "b")!; // (4,5,2)
  b.place(aSlot.x, aSlot.y, aSlot.z, "4"); // a = 4
  b.place(bSlot.x, bSlot.y, bSlot.z, "5"); // b = 5
  const r = b.run(1);
  // 4 + 5 = 9, output at (5,6,2)
  check("A rot=2 output still lands at (x, y+1, z)",
    r.at(5, 6, 2) === "9",
    `got '${r.at(5, 6, 2)}'`);
  // Ensure nothing appeared at east/west (old default output positions)
  check("A rot=2 does not write output east or west",
    r.at(6, 5, 2) === "4" && r.at(4, 5, 2) === "5",
    `east='${r.at(6, 5, 2)}' west='${r.at(4, 5, 2)}'`);
}

// ─── Rotated E mover travels along Z axis ────────────────────────────────────
{
  // E rot=1: direction becomes (0,0,+1) — travels deeper into the grid.
  const b = buildPatch(24, 24, 8);
  b.place(5, 5, 2, "E");
  b.rotate(5, 5, 2, 1);
  const r = b.run(1);
  check("E rot=1 moves to z+1 after 1 tick",
    r.at(5, 5, 3) === "E" && r.at(5, 5, 2) === "",
    `z=2:'${r.at(5, 5, 2)}' z=3:'${r.at(5, 5, 3)}'`);

  r.tick(1);
  check("E rot=1 moves to z+2 after 2 ticks",
    r.at(5, 5, 4) === "E" && r.at(5, 5, 3) === "",
    `z=3:'${r.at(5, 5, 3)}' z=4:'${r.at(5, 5, 4)}'`);
}

// ─── Rotated E explodes at Z boundary ────────────────────────────────────────
{
  // E at z=4 in a depth=5 grid, rot=1 (direction=+Z). z=5 is out of bounds → explode.
  const b = buildPatch(24, 24, 5);
  b.place(5, 5, 4, "E");
  b.rotate(5, 5, 4, 1);
  const r = b.run(1);
  check("E rot=1 at z=4 (boundary) explodes into *",
    r.at(5, 5, 4) === "*",
    `got '${r.at(5, 5, 4)}'`);

  r.tick(1);
  check("explosion star erases on the next tick",
    r.at(5, 5, 4) === "",
    `got '${r.at(5, 5, 4)}'`);
}

// ─── Cross-plane D → : ───────────────────────────────────────────────────────
{
  // D on z=0, `:` on z=1 directly below (y+1).
  // D fires every frame (no mod) → * at (0,1,0).
  // `:` on z=1 at (0,1,1) needs a bang at (0,0,1) to trigger — different plane.
  // This confirms that bang-checking is per-plane (touchingBang looks at same z).
  const b = buildPatch();
  b.place(0, 0, 0, "D"); // fires → * at (0,1,0) on z=0
  b.place(0, 0, 1, ":"); // : on z=1, no adjacent * → should NOT fire
  b.place(1, 0, 1, "0"); // channel
  b.place(2, 0, 1, "4"); // octave
  b.place(3, 0, 1, "C"); // note C
  const r = b.run(1);
  check("D on z=0 does not trigger : on z=1 (bangs are per-plane)",
    r.events.length === 0,
    `got ${r.events.length} events`);
}

summary();
