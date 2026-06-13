import { Cell } from "../cell.js";
import { A } from "./A.js";
import { B } from "./B.js";
import { C } from "./C.js";
import { D } from "./D.js";
import { E } from "./E.js";
import { F } from "./F.js";
import { G } from "./G.js";
import { H } from "./H.js";
import { I } from "./I.js";
import { J } from "./J.js";
import { K } from "./K.js";
import { L } from "./L.js";
import { M } from "./M.js";
import { N } from "./N.js";
import { O } from "./O.js";
import { P } from "./P.js";
import { Q } from "./Q.js";
import { R } from "./R.js";
import { S } from "./S.js";
import { Star } from "./Star.js";
import { T } from "./T.js";
import { U } from "./U.js";
import { V } from "./V.js";
import { W } from "./W.js";
import { X } from "./X.js";
import { Y } from "./Y.js";
import { Z } from "./Z.js";
import { MidiOutOperation } from "./MidiOutOperation.js";
import { CCOperation } from "./CCOperation.js";
import { CommentOperation } from "./Comment.js";

type OperatorCtor = new (x: number, y: number, z: number) => Cell;

const REGISTRY: Record<string, OperatorCtor> = {
  A, B, C, D, E, F, G, H, I, J, K, L, M,
  N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  "*": Star,
  ":": MidiOutOperation,
  "!": CCOperation,
  "#": CommentOperation,
};

export const OPERATOR_HINTS: Record<string, string> = {
  A: "A add(a b): Outputs sum of inputs.",
  B: "B subtract(a b): Outputs difference of inputs.",
  C: "C clock(rate mod): Outputs modulo of frame.",
  D: "D delay(rate mod): Bangs on modulo of frame.",
  E: "E east: Moves eastward, or bangs.",
  F: "F if(a b): Bangs if inputs are equal.",
  G: "G generator(x y z len): Writes operands with offset.",
  H: "H halt: Halts southward operand.",
  I: "I increment(step mod): Increments southward operand.",
  J: "J jumper(val): Outputs northward operand.",
  K: "K konkat(len): Reads multiple variables.",
  L: "L less(a b): Outputs smallest of inputs.",
  M: "M multiply(a b): Outputs product of inputs.",
  N: "N north: Moves Northward, or bangs.",
  O: "O read(x y z): Reads operand with offset.",
  P: "P push(len key val): Writes eastward operand.",
  Q: "Q query(x y z len): Reads operands with offset.",
  R: "R random(min max): Outputs random value.",
  S: "S south: Moves southward, or bangs.",
  T: "T track(key len val): Reads eastward operand.",
  U: "U uclid(step max): Bangs on Euclidean rhythm.",
  V: "V variable(write read): Reads and writes variable.",
  W: "W west: Moves westward, or bangs.",
  X: "X write(x y z val): Writes operand with offset.",
  Y: "Y jymper(val): Outputs westward operand.",
  Z: "Z lerp(rate target): Transitions operand to input.",
  "*": "* bang: Bangs neighboring operands.",
  ":": ": midi(ch oct note velocity*): Send a MIDI note.",
  "!": "! midi cc(ch knob val): Send a MIDI control change.",
  "#": "# comment: Halts a line.",
};

export function getOperatorHint(type: string): string | null {
  return OPERATOR_HINTS[type] ?? null;
}

export function createOperator(key: string, x: number, y: number, z: number): Cell {
  const Ctor = REGISTRY[key];
  if (!Ctor) return new Cell(x, y, z);
  return new Ctor(x, y, z);
}

export { REGISTRY };
