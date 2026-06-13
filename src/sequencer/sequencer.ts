import { Cell, bindSequencer } from "./cell.js";
import { RotateDir } from "./vec3.js";
import { createOperator } from "./operators/index.js";

export type MidiEvent = {
  channel: number;
  note: number;
  velocity: number;
  durationMs: number;
};

export type CellChangeListener = (x: number, y: number, z: number, value: string) => void;

export interface SequencerState {
  frame: number;
  width: number;
  height: number;
  depth: number;
  bpm: number;
  get sixteenth(): number;
  variables: Map<string, string>;
  getCell(x: number, y: number, z: number): Cell;
  modifyCell(x: number, y: number, z: number, value: string): void;
  clearCell(x: number, y: number, z: number): void;
  isOperatorString(v: string): boolean;
  createOperator(v: string, x: number, y: number, z: number): Cell;
  enqueueMidi(event: MidiEvent): void;
  reorientOperator(x: number, y: number, z: number, fwdX: number, fwdZ: number): void;
}

export const OP_KEYS = new Set([
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "*",":","!","#",
]);

export class Sequencer implements SequencerState {
  frame = 0;
  width: number;
  height: number;
  depth: number;
  bpm = 90;
  variables: Map<string, string> = new Map();

  private cells: Map<string, Cell> = new Map();
  private onCellChange: CellChangeListener | null = null;
  private midiQueue: MidiEvent[] = [];
  private midiTriggerCallback: ((x: number, y: number, z: number) => void) | null = null;
  private _currentPos = { x: 0, y: 0, z: 0 };
  private onDimensionsChangeCallback: ((w: number, h: number, d: number) => void) | null = null;

  constructor(width = 24, height = 24, depth = 5) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    bindSequencer(this);
    this._initGrid();
  }

  get sixteenth(): number {
    return 60000 / this.bpm / 4;
  }

  private _key(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  private _initGrid() {
    this.cells = new Map();
  }

  onCellChanged(listener: CellChangeListener) {
    this.onCellChange = listener;
  }

  onDimensionsChanged(listener: (w: number, h: number, d: number) => void) {
    this.onDimensionsChangeCallback = listener;
  }

  forEachCell(cb: (x: number, y: number, z: number, value: string) => void): void {
    for (const cell of this.cells.values()) {
      if (cell.value !== "") cb(cell.position.x, cell.position.y, cell.position.z, cell.value);
    }
  }

  onMidiTriggered(listener: (x: number, y: number, z: number) => void) {
    this.midiTriggerCallback = listener;
  }

  drainMidi(): MidiEvent[] {
    const events = this.midiQueue;
    this.midiQueue = [];
    return events;
  }

  enqueueMidi(event: MidiEvent) {
    this.midiQueue.push(event);
    this.midiTriggerCallback?.(this._currentPos.x, this._currentPos.y, this._currentPos.z);
  }

  // SequencerState interface impl


  // --- SequencerState interface ---

  getCell(x: number, y: number, z: number): Cell {
    if (!this._inBounds(x, y, z)) return new Cell(x, y, z);
    const k = this._key(x, y, z);
    let c = this.cells.get(k);
    if (!c) { c = new Cell(x, y, z); this.cells.set(k, c); }
    return c;
  }

  modifyCell(x: number, y: number, z: number, value: string) {
    if (x < 0 || y < 0 || z < 0) return;

    // Expand the grid when placing a cell outside current bounds.
    // Read-only probes (getCell) do not expand — only explicit writes do.
    if (value !== "" && !this._inBounds(x, y, z)) {
      const PAD = 20;
      let changed = false;
      if (x >= this.width)  { this.width  = x + 1 + PAD; changed = true; }
      if (y >= this.height) { this.height = y + 1 + PAD; changed = true; }
      if (z >= this.depth)  { this.depth  = z + 1 + PAD; changed = true; }
      if (changed) this.onDimensionsChangeCallback?.(this.width, this.height, this.depth);
    }

    if (!this._inBounds(x, y, z)) return;

    const prev = this.getCell(x, y, z);
    prev.removeSelfAsDataParent();

    // If new value is an operator, clobbered data-parent operators must yield
    const clobbered: Cell[] = [];
    if (this.isOperatorString(value)) {
      for (const parent of prev.dataParents) {
        if (prev.id < parent.id) clobbered.push(parent);
      }
      for (const parent of clobbered) parent.removeSelfAsDataParent();
    }

    const newCell = Cell.instantiate(x, y, z, value, [...prev.dataParents]);
    const k = this._key(x, y, z);
    this.cells.set(k, newCell);
    newCell.addSelfAsDataParent();

    // Prune: empty cells claimed by no operator don't need to stay in the map
    if (value === "" && newCell.dataParents.length === 0) {
      this.cells.delete(k);
    }

    for (const parent of clobbered) {
      const p = this.getCell(parent.position.x, parent.position.y, parent.position.z);
      const rebuilt = Cell.instantiate(parent.position.x, parent.position.y, parent.position.z, parent.value, [...p.dataParents]);
      rebuilt.tempCell = parent.tempCell;
      this.cells.set(this._key(parent.position.x, parent.position.y, parent.position.z), rebuilt);
      rebuilt.addSelfAsDataParent();
    }

    this.onCellChange?.(x, y, z, value);

    // Let parent operators with dynamic input slots react to this cell changing
    const changedCell = this.cells.get(k) ?? newCell;
    for (const parent of changedCell.dataParents) {
      if (parent.refreshDynamicInputs()) {
        this.onCellChange?.(parent.position.x, parent.position.y, parent.position.z, parent.value);
      }
    }
  }

  clearCell(x: number, y: number, z: number) {
    this.modifyCell(x, y, z, "");
  }

  isOperatorString(v: string): boolean {
    return OP_KEYS.has(v);
  }

  createOperator(v: string, x: number, y: number, z: number): Cell {
    return createOperator(v, x, y, z);
  }

  // --- Main tick (called by the scheduler each sixteenth) ---

  tick() {
    this.frame++;
    this._updateGrid(this._computeCommentRanges());
  }

  private _computeCommentRanges(): Set<string> {
    const ranges  = new Set<string>();
    const closers = new Set<string>();
    const maxSteps = Math.max(this.width, this.height, this.depth);

    // Process in scan order so earlier openers claim their closers first
    const hashes = [...this.cells.values()]
      .filter(c => c.type === "#")
      .sort((a, b) => a.id - b.id);

    for (const cell of hashes) {
      const { x, y, z } = cell.position;
      const k = this._key(x, y, z);
      if (closers.has(k)) continue; // consumed as a closer
      ranges.add(k);
      const fx = cell.forward.x, fz = cell.forward.z;
      for (let i = 1; i < maxSteps; i++) {
        const nx = x + fx * i, ny = y, nz = z + fz * i;
        if (!this._inBounds(nx, ny, nz)) break;
        const nk = this._key(nx, ny, nz);
        ranges.add(nk);
        if (this.cells.get(nk)?.type === "#") { closers.add(nk); break; }
      }
    }
    return ranges;
  }

  private _updateGrid(commentRanges: Set<string>) {
    // Plain z→y→x scan order, matching Orca's row-major scan on a plane.
    // Stars erase themselves at their own scan turn (see Star.update), so bang
    // visibility follows Orca exactly: same-frame for cells scanned after the
    // producer, next-frame (until the star's turn) for cells scanned before it.
    const sorted = [...this.cells.values()]
      .filter(c => c.value !== "")
      .sort((a, b) => a.id - b.id);

    for (const cell of sorted) {
      const { x, y, z } = cell.position;
      if (commentRanges.has(this._key(x, y, z))) continue;
      this._currentPos.x = x; this._currentPos.y = y; this._currentPos.z = z;
      // Always read the current cell at this position (may have been replaced by a prior update)
      const current = this.cells.get(this._key(x, y, z)) ?? cell;
      // Cell may have been cleared earlier this tick (star self-erase, bang-port clear)
      if (current.value === "") continue;
      // H halts the cell directly below it (Orca: H locks its southward operand) —
      // movers freeze, clocks stop, and stars under an H persist and keep banging.
      if (this.cells.get(this._key(x, y - 1, z))?.type === "H") continue;
      // tempCell lifecycle: operator subclasses override update() and never call super,
      // so the revert-to-lowercase logic in Cell.update() is unreachable for operators.
      // Handle it here before dispatching so the check is guaranteed to run.
      if (current.tempCell && !current.touchingBang()) {
        this.modifyCell(x, y, z, current.value.toLowerCase());
        continue;
      }
      current.update();
    }

    // Second pass: rebuild cells whose data-parent count changed during the tick.
    // Must update prevDataParentLength on the NEW cell (modifyCell replaces the instance).
    for (const cell of [...this.cells.values()]) {
      if (cell.dataParents.length !== cell.prevDataParentLength) {
        const { x, y, z } = cell.position;
        this.modifyCell(x, y, z, cell.value);
        const updated = this.cells.get(this._key(x, y, z));
        if (updated) updated.prevDataParentLength = updated.dataParents.length;
      }
    }
  }

  // --- Patch save/load ---

  serialize(): string {
    const data: string[][][] = [];
    const rotations: Record<string, { fwdX: number; fwdZ: number }> = {};
    for (const cell of this.cells.values()) {
      if (cell.value === "") continue;
      const { x, y, z } = cell.position;
      if (!data[z]) data[z] = [];
      if (!data[z][y]) data[z][y] = [];
      data[z][y][x] = cell.value;
      // Save non-default orientations so loadPatch can restore them exactly.
      if (cell.isOperator() && (cell.forward.x !== 1 || cell.forward.z !== 0)) {
        rotations[`${x},${y},${z}`] = { fwdX: cell.forward.x, fwdZ: cell.forward.z };
      }
    }
    return JSON.stringify({ width: this.width, height: this.height, depth: this.depth, bpm: this.bpm, data, rotations });
  }

  // Clear all cells and notify listeners so the renderer removes stale meshes.
  clearAll() {
    const positions = [...this.cells.values()]
      .filter(c => c.value !== "")
      .map(c => ({ x: c.position.x, y: c.position.y, z: c.position.z }));
    this._initGrid();
    for (const { x, y, z } of positions) this.onCellChange?.(x, y, z, "");
  }

  loadPatch(json: string) {
    const { width, height, depth, bpm, data, rotations = {} } = JSON.parse(json);
    this.bpm = bpm ?? this.bpm;
    // Never shrink below constructor dimensions — old saves (e.g. 24×24×5) must not
    // override a larger grid size set at construction time.
    this.width  = Math.max(this.width,  width  ?? this.width);
    this.height = Math.max(this.height, height ?? this.height);
    this.depth  = Math.max(this.depth,  depth  ?? this.depth);
    bindSequencer(this);
    // Clear existing cells and notify renderer before loading new content.
    this.clearAll();

    for (let z = 0; z < depth; z++)
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[z]?.[y]?.[x]) this.modifyCell(x, y, z, data[z][y][x]);

    // Restore saved operator orientations without moving cells. Argument values are
    // already at their correct absolute positions; we just update the offset maps.
    for (const [key, { fwdX, fwdZ }] of Object.entries(rotations as Record<string, { fwdX: number; fwdZ: number }>)) {
      const [ox, oy, oz] = key.split(",").map(Number);
      const cell = this.getCell(ox, oy, oz);
      if (cell.isOperator()) {
        cell.reorient(fwdX, fwdZ);
        this.onCellChange?.(ox, oy, oz, cell.value);
      }
    }

    // Notify once after load so listeners can resize to the final dimensions.
    this.onDimensionsChangeCallback?.(this.width, this.height, this.depth);
  }

  rotateOperator(x: number, y: number, z: number, dir: RotateDir) {
    const cell = this.getCell(x, y, z);
    if (!cell.isOperator()) return;
    cell.rotate(dir);
    // Fire after rotation+dataParent update is complete so GridAdapter
    // refreshes the operator's input cache with the new positions.
    this.onCellChange?.(x, y, z, cell.value);
  }

  // Reorient an operator to face (fwdX, 0, fwdZ) without moving its argument cells.
  // Use this when loading content where argument values are already at their positions.
  reorientOperator(x: number, y: number, z: number, fwdX: number, fwdZ: number) {
    const cell = this.getCell(x, y, z);
    if (!cell.isOperator()) return;
    cell.reorient(fwdX, fwdZ);
    this.onCellChange?.(x, y, z, cell.value);
  }

  private _inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }
}
