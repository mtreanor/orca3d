import { writeFileSync, mkdirSync } from "fs";
import { Sequencer } from "../src/sequencer/sequencer.js";

const seq = new Sequencer(24, 24, 5);

// ── XY (z=0): A → B → M → L ────────────────────────────────────────────────
// A(3,3): 2+3=5 → (3,4)
seq.modifyCell(2, 3, 0, "2");
seq.modifyCell(3, 3, 0, "A");
seq.modifyCell(4, 3, 0, "3");
// B(4,4): |1−5|=4 → (4,5)
seq.modifyCell(4, 4, 0, "B");
seq.modifyCell(5, 4, 0, "1");
// M(5,5): 4×2=8 → (5,6)
seq.modifyCell(5, 5, 0, "M");
seq.modifyCell(6, 5, 0, "2");
// L(6,6): min(8,9)=8 → (6,7)
seq.modifyCell(6, 6, 0, "L");
seq.modifyCell(7, 6, 0, "9");

// C counter + D pulser on xy
seq.modifyCell(9, 3, 0, "1");
seq.modifyCell(10, 3, 0, "C");
seq.modifyCell(11, 3, 0, "4");
seq.modifyCell(11, 5, 0, "1");
seq.modifyCell(10, 5, 0, "D");

// Second D pulser; lowercase e east of * gets banged → E
seq.modifyCell(15, 5, 0, "1");
seq.modifyCell(14, 5, 0, "D");
seq.modifyCell(15, 6, 0, "e");

// X bridges xy result into zy: copies L output (6,7) to (10,12,2)
seq.modifyCell(2, 7, 0, "2"); // z offset
seq.modifyCell(3, 7, 0, "5"); // x offset → abs x = 5+5 = 10
seq.modifyCell(4, 7, 0, "4"); // y offset → abs y = 7+4+1 = 12
seq.modifyCell(5, 7, 0, "X");

// F: L output (6,7) equals 8 → star
seq.modifyCell(8, 7, 0, "8");
seq.modifyCell(7, 7, 0, "F");

// ── Cross-plane bang: * on z=0 activates n on z=1 ─────────────────────────
seq.modifyCell(14, 6, 1, "n");

// E mover on z=1, rotated to travel +Z
seq.modifyCell(18, 8, 1, "E");
seq.reorientOperator(18, 8, 1, 0, 1);

// ── ZY (z=2): rotated A → I; Z slews the X-written bridge cell ─────────────
seq.modifyCell(10, 10, 1, "3");
seq.modifyCell(10, 10, 2, "A");
seq.reorientOperator(10, 10, 2, 0, 1);
seq.modifyCell(10, 10, 3, "4");
seq.modifyCell(11, 11, 2, "I");
seq.modifyCell(12, 11, 2, "8");
seq.modifyCell(8, 12, 2, "1");
seq.modifyCell(9, 12, 2, "Z");

// C on z=2 mirrors the xy frame counter phase
seq.modifyCell(15, 8, 2, "1");
seq.modifyCell(16, 8, 2, "C");
seq.modifyCell(17, 8, 2, "4");

mkdirSync("patches", { recursive: true });
writeFileSync("patches/demo-chain-2.json", seq.serialize());
console.log("wrote patches/demo-chain-2.json");
