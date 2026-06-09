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

type OperatorCtor = new (x: number, y: number, z: number) => Cell;

const REGISTRY: Record<string, OperatorCtor> = {
  A, B, C, D, E, F, G, H, I, J, K, L, M,
  N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
  "*": Star,
  ":": MidiOutOperation,
  "!": CCOperation,
};

export function createOperator(key: string, x: number, y: number, z: number): Cell {
  const Ctor = REGISTRY[key];
  if (!Ctor) return new Cell(x, y, z);
  return new Ctor(x, y, z);
}

export { REGISTRY };
