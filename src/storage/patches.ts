import type { Sequencer } from "../sequencer/sequencer.js";

const STORAGE_KEY = "arpe_patch";

export function savePatch(seq: Sequencer, name = "default") {
  const data = seq.serialize();
  localStorage.setItem(STORAGE_KEY + "_" + name, data);
}

export function loadPatch(seq: Sequencer, name = "default"): boolean {
  const data = localStorage.getItem(STORAGE_KEY + "_" + name);
  if (!data) return false;
  seq.loadPatch(data);
  return true;
}

export function downloadPatch(seq: Sequencer, filename = "patch.json") {
  const data = seq.serialize();
  const blob = new Blob([data], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function uploadPatch(seq: Sequencer): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("No file")); return; }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          seq.loadPatch(e.target!.result as string);
          resolve();
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function parsePatchText(text: string): string[][][] | null {
  // Parse a plain-text grid: layers separated by blank lines, rows are lines within a layer.
  // Characters map directly to cell values; spaces = empty.
  try {
    const layers = text.trim().split(/\n\s*\n/);
    return layers.map(layer =>
      layer.split("\n").map(row => row.split("").map(ch => ch === " " ? "" : ch))
    );
  } catch { return null; }
}
