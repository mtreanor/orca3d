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
}

export const OP_KEYS = new Set([
  "A","B","C","D","E","F","G","H","I","J","K","L","M",
  "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
  "*",":","!",
]);

export class Sequencer implements SequencerState {
  frame = 0;
  width: number;
  height: number;
  depth: number;
  bpm = 90;
  variables: Map<string, string> = new Map();

  private grid: Cell[][][];
  private onCellChange: CellChangeListener | null = null;
  private midiQueue: MidiEvent[] = [];
  private midiTriggerCallback: ((x: number, y: number, z: number) => void) | null = null;
  private _currentPos = { x: 0, y: 0, z: 0 };

  constructor(width = 24, height = 24, depth = 5) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.grid = [];
    bindSequencer(this);
    this._initGrid();
  }

  get sixteenth(): number {
    return 60000 / this.bpm / 4;
  }

  private _initGrid() {
    this.grid = [];
    for (let z = 0; z < this.depth; z++) {
      this.grid[z] = [];
      for (let y = 0; y < this.height; y++) {
        this.grid[z][y] = [];
        for (let x = 0; x < this.width; x++) {
          this.grid[z][y][x] = new Cell(x, y, z);
        }
      }
    }
  }

  onCellChanged(listener: CellChangeListener) {
    this.onCellChange = listener;
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
    if (this._inBounds(x, y, z)) return this.grid[z][y][x];
    return new Cell(x, y, z);
  }

  modifyCell(x: number, y: number, z: number, value: string) {
    if (!this._inBounds(x, y, z)) return;

    const prev = this.grid[z][y][x];
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
    this.grid[z][y][x] = newCell;
    newCell.addSelfAsDataParent();

    for (const parent of clobbered) {
      const p = this.getCell(parent.position.x, parent.position.y, parent.position.z);
      const rebuilt = Cell.instantiate(parent.position.x, parent.position.y, parent.position.z, parent.value, [...p.dataParents]);
      this.grid[parent.position.z][parent.position.y][parent.position.x] = rebuilt;
      rebuilt.addSelfAsDataParent();
    }

    this.onCellChange?.(x, y, z, value);

    // Let parent operators with dynamic input slots react to this cell changing
    const changedCell = this.grid[z][y][x];
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
    this._removeStars();
    this._updateGrid();
  }

  private _removeStars() {
    for (let z = 0; z < this.depth; z++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const cell = this.grid[z][y][x];
          if (cell.type === "*" && !cell.touchingType("H")) {
            this.clearCell(x, y, z);
          }
        }
  }

  private _updateGrid() {
    for (let z = 0; z < this.depth; z++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          this._currentPos.x = x; this._currentPos.y = y; this._currentPos.z = z;
          this.grid[z][y][x].update();
        }

    for (let z = 0; z < this.depth; z++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const cell = this.grid[z][y][x];
          if (cell.dataParents.length !== cell.prevDataParentLength) {
            this.modifyCell(x, y, z, cell.value);
            cell.prevDataParentLength = cell.dataParents.length;
          }
        }
  }

  // --- Patch save/load ---

  serialize(): string {
    const data: string[][][] = [];
    for (let z = 0; z < this.depth; z++) {
      data[z] = [];
      for (let y = 0; y < this.height; y++) {
        data[z][y] = [];
        for (let x = 0; x < this.width; x++) {
          data[z][y][x] = this.grid[z][y][x].value;
        }
      }
    }
    return JSON.stringify({ width: this.width, height: this.height, depth: this.depth, bpm: this.bpm, data });
  }

  loadPatch(json: string) {
    const { width, height, depth, bpm, data } = JSON.parse(json);
    this.bpm = bpm ?? this.bpm;
    this.width = width;
    this.height = height;
    this.depth = depth;
    bindSequencer(this);
    this._initGrid();

    for (let z = 0; z < depth; z++)
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (data[z]?.[y]?.[x]) this.modifyCell(x, y, z, data[z][y][x]);
  }

  rotateOperator(x: number, y: number, z: number, dir: RotateDir) {
    const cell = this.getCell(x, y, z);
    if (!cell.isOperator()) return;
    cell.rotate(dir);
    // Fire after rotation+dataParent update is complete so GridAdapter
    // refreshes the operator's input cache with the new positions.
    this.onCellChange?.(x, y, z, cell.value);
  }

  private _inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }
}
