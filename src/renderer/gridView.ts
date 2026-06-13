// Adapter layer: the ONLY file that imports from the sequencer engine.
// Everything in renderer/ imports from here, never from sequencer/.

import type { Sequencer } from "../sequencer/sequencer.js";
import type { Cell } from "../sequencer/cell.js";
import { getOperatorHint } from "../sequencer/operators/index.js";

// ---- Public surface exposed to the renderer ----

export type CellKind =
  | "empty"           // no value, no operator claims this slot
  | "ghost"           // empty input slot, side unknown (e.g. above/below)
  | "ghost-left"      // empty input slot to the left of its operator
  | "ghost-right"     // empty input slot to the right of its operator
  | "operator"        // the cell holding an operator letter
  | "mover"           // E, S, N, W
  | "hold"            // H
  | "midi"            // :, !
  | "star"            // * not produced by a trigger operator
  | "star-output"     // * written by D, U, or F — rendered red
  | "argument"        // value in a side-neutral input slot (above/below)
  | "argument-left"   // value in an input slot to the left of its operator
  | "argument-right"  // value in an input slot to the right of its operator
  | "output"          // value written by an operator to its output slot
  | "t-active"        // T table slot currently selected by the key index
  | "comment";        // commented-out cell — greyed, non-executing

export type CellFacing = "right" | "left" | "depth-pos" | "depth-neg";

export interface CellView {
  value: string;
  kind: CellKind;
  facing?: CellFacing;  // present for operator-like cells, absent for data/empty/ghost
}

export type GridChangeListener = (x: number, y: number, z: number, view: CellView) => void;

export interface GridDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface GridView extends GridDimensions {
  getCell(x: number, y: number, z: number): CellView;
  getHint(x: number, y: number, z: number): string | null;
  subscribe(listener: GridChangeListener): () => void;
  eachNonEmptyCell(cb: (x: number, y: number, z: number, view: CellView) => void): void;
  onDimensionsChange: ((dims: GridDimensions) => void) | null;
}

// ---- Classification helpers (private to adapter) ----

const MOVERS        = new Set(["E", "S", "N", "W"]);
const STAR_OUT_OPS  = new Set(["D", "U", "F"]);

function getFacing(cell: Cell): CellFacing {
  const { x, z } = cell.forward;
  if (x > 0) return "right";
  if (x < 0) return "left";
  if (z > 0) return "depth-pos";
  return "depth-neg";
}

type InputSide = "left" | "right" | "neutral";

// Returns the conceptual side of this input slot using slot insertion order,
// which is rotation-invariant: first input = "left", second = "right".
// Returns null if the position is not an input slot of any parent.
// Falls back to "neutral" if multiple parents disagree.
function getInputSide(cell: Cell, x: number, y: number, z: number): InputSide | null {
  let side: InputSide | null = null;
  for (const parent of cell.dataParents) {
    for (const [, offset] of parent.inputs.entries()) {
      if (parent.position.x + offset.x === x &&
          parent.position.y + offset.y === y &&
          parent.position.z + offset.z === z) {
        // Dot product with forward: behind the operator = left (red), ahead = right (green)
        const dot = offset.x * parent.forward.x + offset.z * parent.forward.z;
        const s: InputSide = dot < 0 ? "left" : dot > 0 ? "right" : "neutral";
        if (side === null) side = s;
        else if (side !== s) return "neutral";
      }
    }
  }
  return side;
}

function isOutputSlot(cell: Cell, x: number, y: number, z: number): boolean {
  for (const parent of cell.dataParents) {
    for (const offset of parent.outputs.values()) {
      if (parent.position.x + offset.x === x &&
          parent.position.y + offset.y === y &&
          parent.position.z + offset.z === z) return true;
    }
  }
  return false;
}

function isStarOutputSlot(cell: Cell, x: number, y: number, z: number): boolean {
  for (const parent of cell.dataParents) {
    if (!STAR_OUT_OPS.has(parent.type)) continue;
    for (const [name, offset] of parent.outputs.entries()) {
      if (name === "star" &&
          parent.position.x + offset.x === x &&
          parent.position.y + offset.y === y &&
          parent.position.z + offset.z === z) return true;
    }
  }
  return false;
}

function toView(cell: Cell, x: number, y: number, z: number, cursorNear = false): CellView {
  const { value } = cell;

  if (value === "") {
    if (cursorNear) {
      const side = getInputSide(cell, x, y, z);
      if (side === "left")    return { value: "", kind: "ghost-left" };
      if (side === "right")   return { value: "", kind: "ghost-right" };
      if (side === "neutral") return { value: "", kind: "ghost" };
    }
    return { value: "", kind: "empty" };
  }
  if (cell.type === "*") {
    return { value: "*", kind: isStarOutputSlot(cell, x, y, z) ? "star-output" : "star" };
  }
  if (cell.type === ":" || cell.type === "!") return { value, kind: "midi",     facing: getFacing(cell) };
  if (cell.type === "H")                      return { value, kind: "hold",     facing: getFacing(cell) };
  if (MOVERS.has(cell.type))                  return { value, kind: "mover",    facing: getFacing(cell) };
  if (cell.type !== "Cell")                   return { value, kind: "operator", facing: getFacing(cell) };

  // Data cell — show directional argument colours only when cursor is near the owner operator
  if (isOutputSlot(cell, x, y, z)) return { value, kind: "output" };
  if (cursorNear) {
    const side = getInputSide(cell, x, y, z);
    if (side === "left")  return { value, kind: "argument-left" };
    if (side === "right") return { value, kind: "argument-right" };
    if (side !== null)    return { value, kind: "argument" };
  }
  return { value, kind: "argument" };
}

// ---- T-active helpers ----

// Mirrors Cell.getIntFromString without importing Cell as a value.
function _parseBase36(v: string): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  if (!isNaN(n)) return n;
  const c = v.charCodeAt(0);
  return (c >= 97 && c <= 122) ? 10 + (c - 97) : 0;
}

// ---- Adapter ----

type Pos = { x: number; y: number; z: number };

export class GridAdapter implements GridView {
  width: number;
  height: number;
  depth: number;

  private seq: Sequencer;
  private listeners: Set<GridChangeListener> = new Set();

  // Cache of operator position → its input absolute positions.
  // Needed so we can fire refresh events when an operator is removed.
  private operatorInputCache = new Map<string, Pos[]>();

  // Comment tracking: # positions → their forward direction; commentCells = derived set
  private hashOperators = new Map<string, { x: number; y: number; z: number; fwdX: number; fwdZ: number }>();
  private commentCells: Set<string> = new Set();

  // Cursor position — controls which argument indicators are visible
  private cx = -1;
  private cy = -1;
  private cz = -1;

  onMidiFlash: ((positions: [number, number, number][]) => void) | null = null;
  onDimensionsChange: ((dims: GridDimensions) => void) | null = null;

  constructor(seq: Sequencer) {
    this.seq    = seq;
    this.width  = seq.width;
    this.height = seq.height;
    this.depth  = seq.depth;

    seq.onCellChanged((x, y, z) => this._handleChange(x, y, z));
    seq.onMidiTriggered((x, y, z) => this._handleMidiTrigger(x, y, z));
    seq.onDimensionsChanged((w, h, d) => {
      this.width  = w;
      this.height = h;
      this.depth  = d;
      this.onDimensionsChange?.({ width: w, height: h, depth: d });
    });
  }

  setCursor(x: number, y: number, z: number) {
    if (this.cx === x && this.cy === y && this.cz === z) return;
    const [ox, oy, oz] = [this.cx, this.cy, this.cz];
    this.cx = x; this.cy = y; this.cz = z;
    this._refreshNeighborhood(ox, oy, oz);
    this._refreshNeighborhood(x, y, z);
  }

  getCell(x: number, y: number, z: number): CellView {
    const cell = this.seq.getCell(x, y, z);
    const ck = `${x},${y},${z}`;
    if (cell.value !== "" && this.commentCells.has(ck)) {
      return { value: cell.value, kind: "comment" };
    }
    // Suppress ghost/argument indicators when every owning operator is commented out
    const allParentsCommented = cell.dataParents.length > 0 &&
      cell.dataParents.every(p => this.commentCells.has(`${p.position.x},${p.position.y},${p.position.z}`));
    const view = toView(cell, x, y, z, allParentsCommented ? false : this._cursorNear(cell));
    if (view.kind === "argument" || view.kind === "argument-left" || view.kind === "argument-right") {
      if (this._isTActiveSlot(cell, x, y, z)) return { ...view, kind: "t-active" };
    }
    return view;
  }

  getHint(x: number, y: number, z: number): string | null {
    const cell = this.seq.getCell(x, y, z);
    const ck = `${x},${y},${z}`;

    if (cell.type === "#") return getOperatorHint("#");
    if (this.commentCells.has(ck)) return null;

    if (cell.value !== "" && cell.type !== "Cell") {
      const hint = getOperatorHint(cell.type);
      if (hint) return hint;
    }

    const hints: string[] = [];

    type C = import("../sequencer/cell.js").Cell;
    type V = import("../sequencer/vec3.js").Vec3;

    const matches = (parent: C, offset: V) =>
      parent.position.x + offset.x === x &&
      parent.position.y + offset.y === y &&
      parent.position.z + offset.z === z;

    const parentIsCommented = (parent: C) =>
      this.commentCells.has(`${parent.position.x},${parent.position.y},${parent.position.z}`);

    for (const parent of cell.dataParents) {
      if (parentIsCommented(parent)) continue;
      const inputEntries = [...parent.inputs.entries()];
      for (let i = 0; i < inputEntries.length; i++) {
        const [name, offset] = inputEntries[i];
        if (!matches(parent, offset)) continue;
        const desc = parent.slotDescription(name);
        const side = i === 0 ? " (left)" : i === 1 ? " (right)" : "";
        hints.push(desc ? `${parent.type} · ${name} — ${desc}${side}` : `${parent.type} · ${name}${side}`);
      }
      for (const [name, offset] of parent.outputs.entries()) {
        if (!matches(parent, offset)) continue;
        const desc = parent.slotDescription(name);
        hints.push(desc ? `${parent.type} · ${name} — ${desc}` : `${parent.type} · ${name}`);
      }
    }

    return hints.length > 0 ? hints.join("   |   ") : null;
  }

  subscribe(listener: GridChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  eachNonEmptyCell(cb: (x: number, y: number, z: number, view: CellView) => void): void {
    this.seq.forEachCell((x, y, z) => {
      const view = this.getCell(x, y, z);
      if (view.kind !== "empty") cb(x, y, z, view);
    });
  }

  private _cursorNear(cell: Cell): boolean {
    for (const parent of cell.dataParents) {
      const { x, y, z } = parent.position;
      if (this.cx === x && this.cy === y && this.cz === z) return true;
      for (const off of parent.inputs.values()) {
        if (this.cx === x + off.x && this.cy === y + off.y && this.cz === z + off.z) return true;
      }
      for (const off of parent.outputs.values()) {
        if (this.cx === x + off.x && this.cy === y + off.y && this.cz === z + off.z) return true;
      }
    }
    return false;
  }

  private _refreshNeighborhood(x: number, y: number, z: number) {
    if (x < 0) return;
    this._emit(x, y, z);
    const cell = this.seq.getCell(x, y, z);
    // If this is an operator, refresh all its slots
    if (cell.type !== "Cell" && cell.value !== "") {
      for (const off of cell.inputs.values())  this._emit(x + off.x, y + off.y, z + off.z);
      for (const off of cell.outputs.values()) this._emit(x + off.x, y + off.y, z + off.z);
    }
    // If this cell belongs to parent operators, refresh those operators and all their slots
    for (const parent of cell.dataParents) {
      const { x: px, y: py, z: pz } = parent.position;
      this._emit(px, py, pz);
      for (const off of parent.inputs.values())  this._emit(px + off.x, py + off.y, pz + off.z);
      for (const off of parent.outputs.values()) this._emit(px + off.x, py + off.y, pz + off.z);
    }
  }

  private _emit(x: number, y: number, z: number) {
    const view = this.getCell(x, y, z);
    for (const l of this.listeners) l(x, y, z, view);
  }

  private _handleMidiTrigger(x: number, y: number, z: number) {
    const cell = this.seq.getCell(x, y, z);
    const positions: [number, number, number][] = [[x, y, z]];
    const push = (px: number, py: number, pz: number) => {
      if (px >= 0 && px < this.width && py >= 0 && py < this.height && pz >= 0 && pz < this.depth)
        positions.push([px, py, pz]);
    };
    for (const off of cell.inputs.values())  push(x + off.x, y + off.y, z + off.z);
    for (const off of cell.outputs.values()) push(x + off.x, y + off.y, z + off.z);
    this.onMidiFlash?.(positions);
  }

  private _isTActiveSlot(cell: Cell, x: number, y: number, z: number): boolean {
    for (const parent of cell.dataParents) {
      if (parent.type !== "T") continue;
      const lengthOff = parent.inputs.get("length");
      const keyOff    = parent.inputs.get("key");
      if (!lengthOff || !keyOff) continue;
      const length = _parseBase36(this.seq.getCell(
        parent.position.x + lengthOff.x,
        parent.position.y + lengthOff.y,
        parent.position.z + lengthOff.z,
      ).value) || 1;
      const key = _parseBase36(this.seq.getCell(
        parent.position.x + keyOff.x,
        parent.position.y + keyOff.y,
        parent.position.z + keyOff.z,
      ).value);
      const activeOff = parent.inputs.get("t" + (key % length));
      if (!activeOff) continue;
      if (parent.position.x + activeOff.x === x &&
          parent.position.y + activeOff.y === y &&
          parent.position.z + activeOff.z === z) return true;
    }
    return false;
  }

  private _rebuildComments() {
    const newCells = new Set<string>();
    const closers  = new Set<string>();
    const maxSteps = Math.max(this.width, this.height, this.depth);

    // Sort by scan order (z→y→x) so earlier openers claim their closers first,
    // preventing the closing # from also acting as an opener.
    const sorted = [...this.hashOperators.values()].sort((a, b) =>
      (a.z * this.height * this.width + a.y * this.width + a.x) -
      (b.z * this.height * this.width + b.y * this.width + b.x));

    for (const { x, y, z, fwdX, fwdZ } of sorted) {
      const k = `${x},${y},${z}`;
      if (closers.has(k)) continue; // consumed as a closer — not an opener
      newCells.add(k);
      for (let i = 1; i < maxSteps; i++) {
        const nx = x + fwdX * i, ny = y, nz = z + fwdZ * i;
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height || nz < 0 || nz >= this.depth) break;
        const nk = `${nx},${ny},${nz}`;
        newCells.add(nk);
        if (this.hashOperators.has(nk)) { closers.add(nk); break; }
      }
    }
    this.commentCells = newCells;
  }

  private _handleChange(x: number, y: number, z: number) {
    const opKey  = `${x},${y},${z}`;
    const cell   = this.seq.getCell(x, y, z);
    const isOp   = cell.type !== "Cell" && cell.value !== "";

    // Update # tracking, rebuild comment ranges, then diff to find cells that
    // entered or exited a comment range so their visuals update immediately.
    if (cell.type === "#") {
      this.hashOperators.set(opKey, { x, y, z, fwdX: cell.forward.x, fwdZ: cell.forward.z });
    } else {
      this.hashOperators.delete(opKey);
    }
    const prevCommentCells = this.commentCells;
    this._rebuildComments();

    // Fire event for the cell itself
    this._emit(x, y, z);

    // If there was a previous operator here, refresh its old input positions
    // (they may no longer be ghosts)
    const prevInputs = this.operatorInputCache.get(opKey);
    if (prevInputs) {
      for (const p of prevInputs) this._emit(p.x, p.y, p.z);
      this.operatorInputCache.delete(opKey);
    }

    // If a new operator was placed, cache its inputs and refresh those positions
    if (isOp && cell.inputs.size > 0) {
      const inputs: Pos[] = [];
      for (const offset of cell.inputs.values()) {
        const p = { x: x + offset.x, y: y + offset.y, z: z + offset.z };
        inputs.push(p);
        this._emit(p.x, p.y, p.z);
      }
      this.operatorInputCache.set(opKey, inputs);
    }

    // When any cell belonging to a T operator changes (key, output, etc.), re-emit all
    // of T's table slots so the active-index highlight tracks the live state.
    for (const parent of cell.dataParents) {
      if (parent.type !== "T") continue;
      for (const [slotKey, off] of parent.inputs.entries()) {
        if (!slotKey.startsWith("t")) continue;
        this._emit(parent.position.x + off.x, parent.position.y + off.y, parent.position.z + off.z);
      }
    }

    // Re-emit every cell whose comment status flipped so its appearance updates.
    for (const k of new Set([...prevCommentCells, ...this.commentCells])) {
      if (prevCommentCells.has(k) !== this.commentCells.has(k)) {
        const parts = k.split(",");
        this._emit(+parts[0], +parts[1], +parts[2]);
      }
    }
  }
}
