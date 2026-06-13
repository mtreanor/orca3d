import type { Sequencer } from "../sequencer/sequencer.js";
import type { Scheduler } from "../clock/scheduler.js";
import { savePatch, loadPatch, downloadPatch, uploadPatch } from "../storage/patches.js";

export type PlaneMode = "xy" | "zy";

export interface CursorState {
  x: number;
  y: number;
  z: number;
  planeMode: PlaneMode;
}

export interface SelectionState {
  anchor: { x: number; y: number; z: number };
  cursor: { x: number; y: number; z: number };
}

export function selectionBounds(sel: SelectionState) {
  return {
    minX: Math.min(sel.anchor.x, sel.cursor.x),
    maxX: Math.max(sel.anchor.x, sel.cursor.x),
    minY: Math.min(sel.anchor.y, sel.cursor.y),
    maxY: Math.max(sel.anchor.y, sel.cursor.y),
    minZ: Math.min(sel.anchor.z, sel.cursor.z),
    maxZ: Math.max(sel.anchor.z, sel.cursor.z),
  };
}

type ClipboardEntry = {
  dx: number; dy: number; dz: number;
  value: string;
  isOp: boolean;
  fwdX: number; fwdZ: number;
};

// Cursor can roam freely; the grid expands on demand when a cell is placed.
const MAX_COORD = 9999;

export class KeyboardInput {
  cursor: CursorState = { x: 0, y: 0, z: 0, planeMode: "xy" };

  // Each mode remembers its own slice independently.
  // cursor.z is always == xySlice when in XY mode.
  // cursor.x is always == zySlice when in ZY mode.
  private xySlice: number;
  private zySlice: number;

  private seq: Sequencer;
  private sched: Scheduler;
  private altHeld = false;

  private selectionAnchor: { x: number; y: number; z: number } | null = null;
  private clipboard: ClipboardEntry[] | null = null;

  selection: SelectionState | null = null;

  onCursorMove:      (() => void) | null = null;
  onCenterCamera:    (() => void) | null = null;
  getCameraAlpha:    (() => number) | null = null;
  onSelectionChange: ((sel: SelectionState | null) => void) | null = null;

  constructor(seq: Sequencer, sched: Scheduler) {
    this.seq      = seq;
    this.sched    = sched;
    this.xySlice  = Math.floor(seq.depth / 2);
    this.zySlice  = Math.floor(seq.width / 2);
    window.addEventListener("keydown", e => this._onKey(e));
    window.addEventListener("keyup",   e => {
      if (e.key === "Alt") this.altHeld = false;
    });
  }

  clearSelection() {
    this._clearSelection();
  }

  private _clearSelection() {
    this.selectionAnchor = null;
    this.selection = null;
    this.onSelectionChange?.(null);
  }

  private _onKey(e: KeyboardEvent) {
    if (this._dispatch(e)) e.preventDefault();
  }

  private _dispatch(e: KeyboardEvent): boolean {
    if (e.key === "Alt") { this.altHeld = true; return true; }

    if (e.key === " ") {
      this.sched.isRunning ? this.sched.stop() : this.sched.start();
      return true;
    }

    const isArrow = e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight";
    const step = (e.metaKey || e.ctrlKey) && isArrow ? 8 : 1;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "c" || e.key === "C") { this._copySelection(); return true; }
      if (e.key === "v" || e.key === "V") { this._pasteClipboard(); return true; }
      if (e.key === "s") { savePatch(this.seq); return true; }
      if (e.key === "o") { loadPatch(this.seq); return true; }
      if (e.key === "d") { downloadPatch(this.seq); return true; }
      if (e.key === "u") { uploadPatch(this.seq).catch(() => {}); return true; }
      if (!isArrow) return false;
    }

    // Tab — toggle plane mode, restore that mode's saved slice
    if (e.key === "Tab") {
      if (this.cursor.planeMode === "xy") {
        this.xySlice = this.cursor.z;
        this.cursor.planeMode = "zy";
        this.zySlice = this.cursor.x;
      } else {
        this.zySlice = this.cursor.x;
        this.cursor.planeMode = "xy";
        this.xySlice = this.cursor.z;
      }
      if (this.selectionAnchor) this._rotateSelectionWithPlane();
      this.onCursorMove?.();
      return true;
    }

    if (this.altHeld) {
      const { x, y, z } = this.cursor;

      if (e.key === "c" || e.key === "C") {
        this.onCenterCamera?.();
        return true;
      }

      if (e.key === "ArrowLeft")  { this.seq.rotateOperator(x, y, z, "Y_NEG"); this._syncPlaneToFacing(x, y, z); return true; }
      if (e.key === "ArrowRight") { this.seq.rotateOperator(x, y, z, "Y_POS"); this._syncPlaneToFacing(x, y, z); return true; }

      // Alt+↑/↓ — slide the active plane in/out, cursor stays on it
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const delta = e.key === "ArrowUp" ? 1 : -1;
        if (this.cursor.planeMode === "xy") {
          this.xySlice  = Math.max(0, Math.min(MAX_COORD, this.xySlice + delta));
          this.cursor.z = this.xySlice;
        } else {
          this.zySlice  = Math.max(0, Math.min(MAX_COORD, this.zySlice + delta));
          this.cursor.x = this.zySlice;
        }
        if (e.shiftKey) {
          if (!this.selectionAnchor) this.selectionAnchor = { x, y, z };
          this.selection = {
            anchor: this.selectionAnchor,
            cursor: { x: this.cursor.x, y: this.cursor.y, z: this.cursor.z },
          };
          this.onSelectionChange?.(this.selection);
        }
        this.onCursorMove?.();
        return true;
      }
      return false;
    }

    // Escape — clear selection
    if (e.key === "Escape") {
      if (this.selection) { this._clearSelection(); return true; }
      return false;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown" ||
        e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const { x, y, z } = this.cursor;
      const alpha = this.getCameraAlpha?.() ?? 0;
      if (this.cursor.planeMode === "xy") {
        const xDir = Math.sign(Math.sin(alpha)) || 1;
        if (e.key === "ArrowLeft")  this.cursor.x = Math.max(0, Math.min(MAX_COORD, x + xDir * step));
        if (e.key === "ArrowRight") this.cursor.x = Math.max(0, Math.min(MAX_COORD, x - xDir * step));
        if (e.key === "ArrowUp")    this.cursor.y = Math.max(0, y - step);
        if (e.key === "ArrowDown")  this.cursor.y = Math.min(MAX_COORD, y + step);
      } else {
        const zDir = -Math.sign(Math.cos(alpha)) || 1;
        if (e.key === "ArrowLeft")  this.cursor.z = Math.max(0, Math.min(MAX_COORD, z + zDir * step));
        if (e.key === "ArrowRight") this.cursor.z = Math.max(0, Math.min(MAX_COORD, z - zDir * step));
        if (e.key === "ArrowUp")    this.cursor.y = Math.max(0, y - step);
        if (e.key === "ArrowDown")  this.cursor.y = Math.min(MAX_COORD, y + step);
      }
      if (e.shiftKey) {
        // x, y, z captured above are the OLD position — use as anchor on first extend
        if (!this.selectionAnchor) this.selectionAnchor = { x, y, z };
        this.selection = {
          anchor: this.selectionAnchor,
          cursor: { x: this.cursor.x, y: this.cursor.y, z: this.cursor.z },
        };
        this.onSelectionChange?.(this.selection);
      } else if (this.selectionAnchor) {
        // Translate the whole selection by the same delta the cursor moved
        const dx = this.cursor.x - x;
        const dy = this.cursor.y - y;
        const dz = this.cursor.z - z;
        this.selectionAnchor = {
          x: Math.max(0, Math.min(MAX_COORD, this.selectionAnchor.x + dx)),
          y: Math.max(0, Math.min(MAX_COORD, this.selectionAnchor.y + dy)),
          z: Math.max(0, Math.min(MAX_COORD, this.selectionAnchor.z + dz)),
        };
        this.selection = {
          anchor: this.selectionAnchor,
          cursor: { x: this.cursor.x, y: this.cursor.y, z: this.cursor.z },
        };
        this.onSelectionChange?.(this.selection);
      }
      this.onCursorMove?.();
      return true;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      if (this.selection) {
        const { minX, maxX, minY, maxY, minZ, maxZ } = selectionBounds(this.selection);
        for (let gz = minZ; gz <= maxZ; gz++)
          for (let gy = minY; gy <= maxY; gy++)
            for (let gx = minX; gx <= maxX; gx++)
              this.seq.clearCell(gx, gy, gz);
        this._clearSelection();
      } else {
        this.seq.clearCell(this.cursor.x, this.cursor.y, this.cursor.z);
      }
      return true;
    }

    if (e.key === "[") { this.seq.bpm = Math.max(10,  this.seq.bpm - 5); return true; }
    if (e.key === "]") { this.seq.bpm = Math.min(300, this.seq.bpm + 5); return true; }

    if (e.key.length === 1) {
      const ch = e.key;
      if (/^[A-Z*:!#]$/.test(ch) || /^[0-9a-z]$/.test(ch)) {
        const { x, y, z } = this.cursor;
        this.seq.modifyCell(x, y, z, ch);
        // Auto-orient operator to face into the active editing plane
        const placed = this.seq.getCell(x, y, z);
        if (placed.isOperator()) {
          const facesZ = placed.forward.z !== 0;
          if (this.cursor.planeMode === "zy" && !facesZ) {
            this.seq.rotateOperator(x, y, z, "Y_POS");
          } else if (this.cursor.planeMode === "xy" && facesZ) {
            this.seq.rotateOperator(x, y, z, "Y_POS");
          }
        }
        this.onCursorMove?.();
        return true;
      }
    }

    return false;
  }

  jumpTo(x: number, y: number, z: number) {
    this.cursor.x = x;
    this.cursor.y = y;
    this.cursor.z = z;
    this.xySlice  = z;
    this.zySlice  = x;
    this.onCursorMove?.();
  }

  private _syncPlaneToFacing(opX: number, _opY: number, opZ: number) {
    const cell = this.seq.getCell(opX, _opY, opZ);
    if (!cell.isOperator()) return;
    const facesZ = cell.forward.z !== 0;
    if (facesZ && this.cursor.planeMode !== "zy") {
      this.xySlice = this.cursor.z;
      this.cursor.planeMode = "zy";
      this.zySlice = opX;
      this.cursor.x = opX;
    } else if (!facesZ && this.cursor.planeMode !== "xy") {
      this.zySlice = this.cursor.x;
      this.cursor.planeMode = "xy";
      this.xySlice = opZ;
      this.cursor.z = opZ;
    }
    this.onCursorMove?.();
  }

  private _rotateSelectionWithPlane() {
    if (!this.selectionAnchor) return;
    const { x: cx, y: cy, z: cz } = this.cursor;
    const adx = this.selectionAnchor.x - cx;
    const ady = this.selectionAnchor.y - cy;
    const adz = this.selectionAnchor.z - cz;

    // cursor.planeMode is already the NEW mode after the Tab switch.
    // XY → ZY: Y_NEG 90° CW about Y: (adx, adz) → (−adz, adx)
    // ZY → XY: Y_POS 90° CCW about Y: (adx, adz) → (adz, −adx)
    let newDx: number, newDz: number;
    if (this.cursor.planeMode === "zy") {
      newDx = -adz;
      newDz =  adx;
    } else {
      newDx =  adz;
      newDz = -adx;
    }

    this.selectionAnchor = {
      x: Math.max(0, Math.min(MAX_COORD, cx + newDx)),
      y: Math.max(0, Math.min(MAX_COORD, cy + ady)),
      z: Math.max(0, Math.min(MAX_COORD, cz + newDz)),
    };
    this.selection = {
      anchor: this.selectionAnchor,
      cursor: { x: cx, y: cy, z: cz },
    };
    this.onSelectionChange?.(this.selection);
  }

  private _copySelection() {
    const sel = this.selection;
    let minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number;
    if (sel) {
      ({ minX, maxX, minY, maxY, minZ, maxZ } = selectionBounds(sel));
    } else {
      minX = maxX = this.cursor.x;
      minY = maxY = this.cursor.y;
      minZ = maxZ = this.cursor.z;
    }

    this.clipboard = [];
    for (let gz = minZ; gz <= maxZ; gz++)
      for (let gy = minY; gy <= maxY; gy++)
        for (let gx = minX; gx <= maxX; gx++) {
          const cell = this.seq.getCell(gx, gy, gz);
          if (cell.value !== "") {
            this.clipboard.push({
              dx: gx - minX, dy: gy - minY, dz: gz - minZ,
              value: cell.value,
              isOp: cell.isOperator(),
              fwdX: cell.forward.x,
              fwdZ: cell.forward.z,
            });
          }
        }
  }

  private _pasteClipboard() {
    if (!this.clipboard || this.clipboard.length === 0) return;
    const { x, y, z } = this.cursor;
    for (const entry of this.clipboard) {
      const px = x + entry.dx;
      const py = y + entry.dy;
      const pz = z + entry.dz;
      this.seq.modifyCell(px, py, pz, entry.value);
      if (entry.isOp) {
        for (const dir of this._rotationsToForward(entry.fwdX, entry.fwdZ)) {
          this.seq.rotateOperator(px, py, pz, dir);
        }
      }
    }
    this.onCursorMove?.();
  }

  private _rotationsToForward(fwdX: number, fwdZ: number): Array<"Y_NEG" | "Y_POS"> {
    if (fwdX > 0) return [];                  // (1,0,0) — default
    if (fwdZ > 0) return ["Y_NEG"];           // (0,0,1)
    if (fwdX < 0) return ["Y_NEG", "Y_NEG"]; // (-1,0,0)
    return ["Y_POS"];                         // (0,0,-1)
  }

}
