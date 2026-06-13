import { writeFileSync, mkdirSync } from "fs";
import { Sequencer } from "../src/sequencer/sequencer.js";

const seq = new Sequencer(24, 24, 5);

// XY (z=0): A → B → M
seq.modifyCell(4, 4, 0, "4");
seq.modifyCell(5, 4, 0, "A");
seq.modifyCell(6, 4, 0, "5");
seq.modifyCell(6, 5, 0, "B");
seq.modifyCell(7, 5, 0, "1");
seq.modifyCell(7, 6, 0, "M");
seq.modifyCell(8, 6, 0, "2");

// D pulses *; lowercase e east of star is banged → E
seq.modifyCell(10, 10, 0, "D");
seq.modifyCell(11, 10, 0, "1");
seq.modifyCell(11, 11, 0, "e");

// ZY (z=2): rotated A → I
seq.modifyCell(10, 10, 1, "2");
seq.modifyCell(10, 10, 2, "A");
seq.reorientOperator(10, 10, 2, 0, 1);
seq.modifyCell(10, 10, 3, "b");
seq.modifyCell(11, 11, 2, "I");
seq.modifyCell(12, 11, 2, "c");

// Rotated E on z=1 travels +Z
seq.modifyCell(15, 10, 1, "E");
seq.reorientOperator(15, 10, 1, 0, 1);

mkdirSync("patches", { recursive: true });
writeFileSync("patches/demo-chain.json", seq.serialize());
