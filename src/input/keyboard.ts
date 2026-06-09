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

  onCursorMove:    (() => void) | null = null;
  onCenterCamera:  (() => void) | null = null;
  getCameraAlpha:  (() => number) | null = null;

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

  private _onKey(e: KeyboardEvent) {
    if (this._dispatch(e)) e.preventDefault();
  }

  private _dispatch(e: KeyboardEvent): boolean {
    if (e.key === "Alt") { this.altHeld = true; return true; }

    if (e.key === " ") {
      this.sched.isRunning ? this.sched.stop() : this.sched.start();
      return true;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s") { savePatch(this.seq); return true; }
      if (e.key === "o") { loadPatch(this.seq); return true; }
      if (e.key === "d") { downloadPatch(this.seq); return true; }
      if (e.key === "u") { uploadPatch(this.seq).catch(() => {}); return true; }
      return false;
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
          this.xySlice  = Math.max(0, Math.min(this.seq.depth - 1, this.xySlice + delta));
          this.cursor.z = this.xySlice;
        } else {
          this.zySlice  = Math.max(0, Math.min(this.seq.width - 1, this.zySlice + delta));
          this.cursor.x = this.zySlice;
        }
        this.onCursorMove?.();
        return true;
      }
      return false;
    }

    if (e.key === "ArrowUp" || e.key === "ArrowDown" ||
        e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const { x, y, z } = this.cursor;
      const alpha = this.getCameraAlpha?.() ?? 0;
      if (this.cursor.planeMode === "xy") {
        const xDir = Math.sign(Math.sin(alpha)) || 1;
        if (e.key === "ArrowLeft")  this.cursor.x = Math.max(0, Math.min(this.seq.width  - 1, x + xDir));
        if (e.key === "ArrowRight") this.cursor.x = Math.max(0, Math.min(this.seq.width  - 1, x - xDir));
        if (e.key === "ArrowUp")    this.cursor.y = Math.max(0, y - 1);
        if (e.key === "ArrowDown")  this.cursor.y = Math.min(this.seq.height - 1, y + 1);
      } else {
        const zDir = -Math.sign(Math.cos(alpha)) || 1;
        if (e.key === "ArrowLeft")  this.cursor.z = Math.max(0, Math.min(this.seq.depth  - 1, z + zDir));
        if (e.key === "ArrowRight") this.cursor.z = Math.max(0, Math.min(this.seq.depth  - 1, z - zDir));
        if (e.key === "ArrowUp")    this.cursor.y = Math.max(0, y - 1);
        if (e.key === "ArrowDown")  this.cursor.y = Math.min(this.seq.height - 1, y + 1);
      }
      this.onCursorMove?.();
      return true;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      this.seq.clearCell(this.cursor.x, this.cursor.y, this.cursor.z);
      return true;
    }

    if (e.key === "[") { this.seq.bpm = Math.max(10,  this.seq.bpm - 5); return true; }
    if (e.key === "]") { this.seq.bpm = Math.min(300, this.seq.bpm + 5); return true; }

    if (e.key.length === 1) {
      const ch = e.key;
      if (/^[A-Z*:!]$/.test(ch) || /^[0-9a-z]$/.test(ch)) {
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
}
