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

/** Centre of the bounding box of all non-empty cells, or null when the grid is empty. */
export function patchContentCenter(seq: Sequencer): { x: number; y: number; z: number } | null {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let any = false;

  seq.forEachCell((x, y, z) => {
    any = true;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  });

  if (!any) return null;
  return {
    x: Math.floor((minX + maxX) / 2),
    y: Math.floor((minY + maxY) / 2),
    z: Math.floor((minZ + maxZ) / 2),
  };
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

export async function saveAsFile(seq: Sequencer): Promise<void> {
  const data = seq.serialize();
  if ("showSaveFilePicker" in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: "patch.json",
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return;
    }
  }
  downloadPatch(seq);
}

export function uploadOrca(
  seq: Sequencer,
  cx: number, cy: number, cz: number,
  planeMode: "xy" | "zy",
): Promise<void> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".orca";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("No file")); return; }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          // Clear any stale content from prior sessions before importing.
          seq.clearAll();
          // Split on all common line-ending styles
          const rows = (e.target!.result as string).split(/\r\n|\r|\n/);
          // Drop a trailing empty line if the file ends with a newline
          if (rows.length > 0 && rows[rows.length - 1] === "") rows.pop();
          for (let row = 0; row < rows.length; row++) {
            const line = rows[row];
            for (let col = 0; col < line.length; col++) {
              const ch = line[col];
              if (ch === ".") continue;
              // Columns always start at 0 in the in-plane axis so the full
              // file width loads regardless of cursor x/z position.
              // Cursor y sets the vertical start; the perpendicular axis
              // (cz for xy, cx for zy) sets the depth layer.
              const x = planeMode === "xy" ? col : cx;
              const y = cy + row;
              const z = planeMode === "xy" ? cz : col;
              // modifyCell expands the grid as needed — no explicit bounds check required.
              if (x >= 0 && y >= 0 && z >= 0) {
                seq.modifyCell(x, y, z, ch);
                // In ZY mode, columns map to the Z axis. Operators must face +Z so
                // their input offsets align with the column-based argument positions.
                // Y_NEG rotation: (1,0,0) → (0,0,1), keeping first input at z-1 (left col).
                if (planeMode === "zy" && seq.getCell(x, y, z).isOperator()) {
                  seq.reorientOperator(x, y, z, 0, 1);
                }
              }
            }
          }
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
