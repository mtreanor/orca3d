// Validates patches/demo-chain.json — load via serialize format and assert behavior.
import { readFileSync } from "fs";
import { Sequencer } from "../src/sequencer/sequencer.js";
import { check, summary } from "./harness.js";

function loadDemoPatch(): Sequencer {
  const json = readFileSync(new URL("../patches/demo-chain.json", import.meta.url), "utf8");
  const seq = new Sequencer(24, 24, 5);
  seq.loadPatch(json);
  return seq;
}

{
  const seq = loadDemoPatch();
  seq.tick();

  // XY chain: A(4+5) → B(|1−9|) → M(9×2)
  check("A output is 9", seq.getCell(5, 5, 0).value === "9");
  check("B output is 8", seq.getCell(6, 6, 0).value === "8");
  check("M output is g (9×2)", seq.getCell(7, 7, 0).value === "g");

  // D fires * south; lowercase e west of * is banged → E hops east
  check("D writes * at (10,5)", seq.getCell(10, 5, 0).value === "*");
  check("banged e becomes E at (12,5)", seq.getCell(12, 5, 0).value === "E");
  check("e source cell cleared", seq.getCell(11, 5, 0).value === "");

  // ZY plane: rotated A reads z-axis inputs; uppercase B → uppercase output
  check("rotated A output is D (2+B, sensitive)", seq.getCell(10, 11, 2).value === "D");
  check("I accumulates A output mod c", seq.getCell(11, 12, 2).value === "1");

  // Rotated E travels +Z
  check("E rot=1 moves to z+1", seq.getCell(15, 10, 2).value === "E");
  check("E leaves origin", seq.getCell(15, 10, 1).value === "");
}

summary();
