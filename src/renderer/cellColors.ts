import { Color3 } from "@babylonjs/core";
import type { CellKind } from "./gridView.js";

export interface CellColors {
  diffuse:  Color3;
  emissive: Color3;
}

const KIND_DIFFUSE: Record<CellKind, Color3> = {
  empty:            Color3.FromHexString("#0d0d1a"),
  ghost:            Color3.FromHexString("#2a3a5a"),
  "ghost-left":     Color3.FromHexString("#cc3333"),  // port red
  "ghost-right":    Color3.FromHexString("#33cc55"),  // starboard green
  operator:         Color3.FromHexString("#ffffff"),
  mover:            Color3.FromHexString("#aaffcc"),
  hold:             Color3.FromHexString("#ccaaff"),
  midi:             Color3.FromHexString("#55ccff"),
  star:             Color3.FromHexString("#ffdd66"),
  "star-output":    Color3.FromHexString("#ff5555"),
  argument:         Color3.FromHexString("#000008"),
  "argument-left":  Color3.FromHexString("#000008"),
  "argument-right": Color3.FromHexString("#000008"),
  output:           Color3.FromHexString("#000008"),
};

const KIND_EMISSIVE: Record<CellKind, Color3> = {
  empty:            new Color3(0,    0,    0),
  ghost:            new Color3(0.04, 0.06, 0.14),
  "ghost-left":     new Color3(0.90, 0.08, 0.08),  // port red — full brightness so wireframe lines are visible
  "ghost-right":    new Color3(0.08, 0.90, 0.22),  // starboard green
  operator:         new Color3(0.28, 0.30, 0.36),
  mover:            new Color3(0.18, 0.36, 0.26),
  hold:             new Color3(0.24, 0.18, 0.38),
  midi:             new Color3(0.12, 0.30, 0.44),
  star:             new Color3(0.38, 0.30, 0.06),
  "star-output":    new Color3(0.44, 0.06, 0.06),
  argument:         new Color3(0.08, 0.08, 0.10),
  "argument-left":  new Color3(0.18, 0.03, 0.03),
  "argument-right": new Color3(0.03, 0.18, 0.06),
  output:           new Color3(0.05, 0.12, 0.18),
};

export const KIND_GLOW_INTENSITY: Record<CellKind, number> = {
  empty:            0,
  ghost:            0,
  "ghost-left":     0,
  "ghost-right":    0,
  operator:         0.25,
  mover:            0.25,
  hold:             0.22,
  midi:             0.30,
  star:             0.35,
  "star-output":    0.40,
  argument:         0.35,
  "argument-left":  0.55,
  "argument-right": 0.55,
  output:           0.45,
};

export function getCellColors(kind: CellKind): CellColors {
  return {
    diffuse:  KIND_DIFFUSE[kind],
    emissive: KIND_EMISSIVE[kind],
  };
}

export function textColor(kind: CellKind): string {
  switch (kind) {
    case "star":            return "#ffee88";
    case "star-output":     return "#ff8888";
    case "ghost":
    case "ghost-left":
    case "ghost-right":     return "#4466aa";
    case "argument":        return "#ffffff";
    case "argument-left":   return "#ffcccc";
    case "argument-right":  return "#ccffdd";
    case "output":          return "#ccf0ff";
    default:                return "#ffffff";
  }
}
