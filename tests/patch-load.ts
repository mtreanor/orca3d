// Verify demo patch files load through the same path as the app (Sequencer.loadPatch).
import { readFileSync } from "fs";
import { Sequencer } from "../src/sequencer/sequencer.js";
import { check, summary } from "./harness.js";

const PATCHES = ["demo-chain.json", "demo-chain-2.json"] as const;

interface LoadedPatch {
  seq: Sequencer;
  operatorCount: number;
  filledCount: number;
  rotations: Record<string, { fwdX: number; fwdZ: number }>;
}

function loadPatchFile(filename: string): LoadedPatch {
  const json = readFileSync(new URL(`../patches/${filename}`, import.meta.url), "utf8");
  const parsed = JSON.parse(json) as {
    width: number;
    height: number;
    depth: number;
    rotations?: Record<string, { fwdX: number; fwdZ: number }>;
  };

  const seq = new Sequencer(24, 24, 5);
  seq.loadPatch(json);

  let operatorCount = 0;
  let filledCount = 0;
  for (let z = 0; z < parsed.depth; z++) {
    for (let y = 0; y < parsed.height; y++) {
      for (let x = 0; x < parsed.width; x++) {
        const cell = seq.getCell(x, y, z);
        if (cell.value === "") continue;
        filledCount++;
        if (cell.isOperator()) operatorCount++;
      }
    }
  }

  return {
    seq,
    operatorCount,
    filledCount,
    rotations: parsed.rotations ?? {},
  };
}

for (const filename of PATCHES) {
  let loaded: LoadedPatch;
  try {
    loaded = loadPatchFile(filename);
    check(`${filename} loads without error`, true);
  } catch (err) {
    check(`${filename} loads without error`, false, String(err));
    continue;
  }

  check(`${filename} restores grid content`, loaded.filledCount > 0, `filled=${loaded.filledCount}`);
  check(`${filename} has operators`, loaded.operatorCount >= 6, `operators=${loaded.operatorCount}`);

  for (const [key, rot] of Object.entries(loaded.rotations)) {
    const [x, y, z] = key.split(",").map(Number);
    const cell = loaded.seq.getCell(x, y, z);
    check(
      `${filename} rotation ${key}`,
      cell.forward.x === rot.fwdX && cell.forward.z === rot.fwdZ,
      `got (${cell.forward.x}, ${cell.forward.z})`,
    );
  }

  try {
    loaded.seq.tick();
    check(`${filename} ticks after load`, true);
  } catch (err) {
    check(`${filename} ticks after load`, false, String(err));
  }
}

summary();
