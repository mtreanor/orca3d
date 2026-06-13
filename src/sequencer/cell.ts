import {
  Vec3, vec3, addVec3, scaleVec3, rotateVector90, RotateDir, VEC3_RIGHT,
} from "./vec3.js";
import type { SequencerState } from "./sequencer.js";

// Populated by sequencer.ts after init to avoid circular-import issues at load time.
let seq: SequencerState;
export function bindSequencer(s: SequencerState) { seq = s; }

export class Cell {
  type = "Cell";
  value = "";

  createdFrame = 0;
  tempCell = false;
  active = true;

  position: Vec3;
  dataParents: Cell[] = [];
  prevDataParentLength = 0;

  forward: Vec3 = { ...VEC3_RIGHT };

  get DOWN(): Vec3 {
    return { x: 0, y: 1, z: 0 };
  }

  inputs: Map<string, Vec3> = new Map();
  outputs: Map<string, Vec3> = new Map();

  constructor(x: number, y: number, z: number) {
    this.position = vec3(x, y, z);
  }

  get id(): number {
    const { x, y, z } = this.position;
    return z * seq.width * seq.height + y * seq.width + x;
  }

  // --- Static helpers ---

  static getIntFromString(value: string): number {
    if (value === "") return 0;
    const n = parseInt(value, 10);
    if (!isNaN(n)) return n;
    const ch = value[0].toLowerCase();
    if (ch >= "a" && ch <= "z") return 10 + (ch.charCodeAt(0) - "a".charCodeAt(0));
    return 0;
  }

  static readonly BASE36_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
  static base36(value: number): string {
    value = ((value % 36) + 36) % 36;
    return value === 0 ? "0" : Cell.BASE36_CHARS[value];
  }

  // --- Instance helpers ---

  readValueFromOffset(offset: Vec3): string {
    const p = addVec3(this.position, offset);
    return seq.getCell(p.x, p.y, p.z).value;
  }

  // Mirrors Orca `listen(port, true)`: defVal applies when the cell is empty
  // or holds '*', then optional clamp is applied. Orca also supports per-port
  // `default` glyphs (e.g. midi velocity 'f'); pass that as defVal here.
  getIntInput(name: string, defVal = 0, min?: number, max?: number): number {
    const offset = this.inputs.get(name);
    if (!offset) return defVal;
    const p = addVec3(this.position, offset);
    const raw = seq.getCell(p.x, p.y, p.z).value;
    // Orca's listen treats '*' like an empty cell for value reads
    let v = raw === "" || raw === "*" ? defVal : Cell.getIntFromString(raw);
    if (min !== undefined && v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  }

  getIntOutput(name: string, defVal = 0): number {
    const offset = this.outputs.get(name);
    if (!offset) return defVal;
    const p = addVec3(this.position, offset);
    const raw = seq.getCell(p.x, p.y, p.z).value;
    return raw === "" || raw === "*" ? defVal : Cell.getIntFromString(raw);
  }

  // Orca "sensitive" outputs: the result is uppercased when the cell one step
  // along `forward` (the east operand at default orientation) holds an
  // uppercase letter. This is how patches produce natural notes (C vs c).
  protected sensitiveCase(val: string): string {
    const p = addVec3(this.position, this.forward);
    const g = seq.getCell(p.x, p.y, p.z).value;
    if (g === "") return val;
    const ch = g[0];
    if (ch.toLowerCase() === ch.toUpperCase()) return val; // not a letter
    return ch === ch.toUpperCase() ? val.toUpperCase() : val;
  }

  // Write a base36 value to a named output cell
  protected writeOutput(name: string, val: string) {
    const offset = this.outputs.get(name)!;
    const p = addVec3(this.position, offset);
    seq.modifyCell(p.x, p.y, p.z, val);
  }

  // Write to an absolute grid position
  protected writeCell(x: number, y: number, z: number, val: string) {
    seq.modifyCell(x, y, z, val);
  }

  protected clearAt(x: number, y: number, z: number) {
    seq.clearCell(x, y, z);
  }

  protected reorientAt(x: number, y: number, z: number, fwdX: number, fwdZ: number) {
    seq.reorientOperator(x, y, z, fwdX, fwdZ);
  }

  protected get seqFrame(): number { return seq.frame; }
  protected get seqSixteenth(): number { return seq.sixteenth; }
  protected get seqVariables(): Map<string, string> { return seq.variables; }
  protected get seqW(): number { return seq.width; }
  protected get seqH(): number { return seq.height; }
  protected get seqD(): number { return seq.depth; }
  protected enqueueMidi(event: import("./sequencer.js").MidiEvent) { seq.enqueueMidi(event); }

  // Read a cell value at absolute coords
  protected readCell(x: number, y: number, z: number): string {
    return seq.getCell(x, y, z).value;
  }

  touchingType(type: string): boolean {
    const { x, y, z } = this.position;
    return [
      seq.getCell(x - 1, y, z), seq.getCell(x + 1, y, z),
      seq.getCell(x, y - 1, z), seq.getCell(x, y + 1, z),
      seq.getCell(x, y, z - 1), seq.getCell(x, y, z + 1),
    ].some(c => c.type === type);
  }

  touchingBang(): boolean { return this.touchingType("*"); }

  isOperator(): boolean { return seq.isOperatorString(this.value) && this.type !== "Cell"; }

  isLowerOperator(): boolean {
    if (this.value === "") return false;
    const ch = this.value[0];
    if (ch < "a" || ch > "z") return false;
    if (this.dataParents.length !== 0) return false;
    return seq.isOperatorString(this.value.toUpperCase());
  }

  isData(): boolean { return this.dataParents.length > 0; }
  isOnlyData(): boolean { return this.isData() && this.type === "Cell"; }

  // --- Data parent tracking ---

  addDataParent(parent: Cell) {
    if (!this.dataParents.includes(parent)) this.dataParents.push(parent);
  }

  removeDataParent(parent: Cell) {
    const i = this.dataParents.indexOf(parent);
    if (i !== -1) this.dataParents.splice(i, 1);
  }

  addSelfAsDataParent() {
    this._applyToNeighbors(this.inputs, "add");
    this._applyToNeighbors(this.outputs, "add");
  }

  removeSelfAsDataParent() {
    this._applyToNeighbors(this.inputs, "remove");
    this._applyToNeighbors(this.outputs, "remove");
  }

  private _applyToNeighbors(map: Map<string, Vec3>, mode: "add" | "remove") {
    for (const offset of map.values()) {
      const p = addVec3(this.position, offset);
      const cell = seq.getCell(p.x, p.y, p.z);
      if (mode === "add") cell.addDataParent(this);
      else cell.removeDataParent(this);
    }
  }

  getDataPosition(name: string, mode: "inputs" | "outputs"): Vec3 {
    const map = mode === "inputs" ? this.inputs : this.outputs;
    const offset = map.get(name);
    if (!offset) return vec3(0, 0, 0);
    return addVec3(this.position, offset);
  }

  // --- Rotation ---

  rotate(dir: RotateDir) {
    this.forward = rotateVector90(this.forward, dir);
    this._rotateMap(this.inputs, dir);
    // outputs are pinned to (0,1,0) per design — never rotate
  }

  // Override in operators with length-driven dynamic input slots.
  // Should resize inputs, fire writeCell for removed/added slot positions, and return true if changed.
  refreshDynamicInputs(): boolean { return false; }

  slotDescription(_slotName: string): string | null {
    return null;
  }

  // Reorient the operator's forward vector and input offsets to face (fwdX, 0, fwdZ)
  // WITHOUT moving the argument cells in the grid. Used when restoring a saved patch
  // (where cell values sit at their original absolute positions) and when loading ORCA
  // content into a plane whose column axis differs from the default +X direction.
  reorient(fwdX: number, fwdZ: number) {
    if (this.forward.x === fwdX && this.forward.z === fwdZ) return;
    this.removeSelfAsDataParent();
    // Y_NEG cycles the four orientations: +X → +Z → -X → -Z → +X
    for (let guard = 0; guard < 4 && (this.forward.x !== fwdX || this.forward.z !== fwdZ); guard++) {
      this.forward = rotateVector90(this.forward, "Y_NEG");
      const rotated = new Map<string, Vec3>();
      for (const [key, offset] of this.inputs.entries()) rotated.set(key, rotateVector90(offset, "Y_NEG"));
      this.inputs = rotated;
    }
    this.addSelfAsDataParent();
  }

  private _rotateMap(map: Map<string, Vec3>, dir: RotateDir) {
    const entries = Array.from(map.entries());
    this.removeSelfAsDataParent();

    const rotated = new Map<string, Vec3>();
    for (const [key, offset] of entries) {
      const oldPos = addVec3(this.position, offset);
      const oldCell = seq.getCell(oldPos.x, oldPos.y, oldPos.z);
      const newOffset = rotateVector90(offset, dir);
      rotated.set(key, newOffset);
      const newPos = addVec3(this.position, newOffset);
      seq.clearCell(oldPos.x, oldPos.y, oldPos.z);
      // Only move content that actually exists — writing "" to newPos would
      // clobber whatever was already there (e.g. argument values placed before rotation).
      if (oldCell.value !== "") seq.modifyCell(newPos.x, newPos.y, newPos.z, oldCell.value);
    }

    map.clear();
    for (const [k, v] of rotated) map.set(k, v);
    this.addSelfAsDataParent();
  }

  justCreated(): boolean { return this.createdFrame === seq.frame; }

  // --- Core update: handles lower-operator activation ---

  update() {
    if (this.isLowerOperator() || this.tempCell) {
      if (this.touchingBang()) {
        if (!this.tempCell) {
          seq.modifyCell(this.position.x, this.position.y, this.position.z, this.value.toUpperCase());
          const newCell = seq.getCell(this.position.x, this.position.y, this.position.z);
          newCell.tempCell = true;
          newCell.update();
          return;
        }
      } else {
        if (this.tempCell) {
          seq.modifyCell(this.position.x, this.position.y, this.position.z, this.value.toLowerCase());
          return;
        }
      }
    }
  }

  // --- Factory ---

  static instantiate(x: number, y: number, z: number, value = "", parents: Cell[] | null = null): Cell {
    const noParents = !parents || parents.length === 0;
    const isStar = value === "*";
    let cell: Cell;

    if (seq.isOperatorString(value) && (noParents || isStar)) {
      cell = seq.createOperator(value, x, y, z);
    } else {
      cell = new Cell(x, y, z);
    }

    cell.value = value;
    cell.dataParents = parents ?? [];
    cell.createdFrame = seq.frame;
    return cell;
  }
}

export function scaleAdd(a: Vec3, b: Vec3, n: number): Vec3 {
  return addVec3(a, scaleVec3(b, n));
}
