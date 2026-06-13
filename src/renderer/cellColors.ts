import { Color3 } from "@babylonjs/core";
import type { CellKind } from "./gridView.js";
import { THEME } from "./theme.js";

export interface CellColors {
  diffuse:  Color3;
  emissive: Color3;
}

// Map from the internal CellKind identifiers to the human-readable theme keys.
const C = THEME.cells;
type ThemeKey = keyof typeof C;

const KIND_TO_THEME: Record<CellKind, ThemeKey> = {
  empty:            "empty",
  ghost:            "ghost",
  "ghost-left":     "ghostPortLeft",
  "ghost-right":    "ghostPortRight",
  operator:         "operator",
  mover:            "mover",
  hold:             "hold",
  midi:             "midi",
  star:             "bang",
  "star-output":    "bangOutput",
  argument:         "argument",
  "argument-left":  "argumentLeft",
  "argument-right": "argumentRight",
  output:           "output",
  "t-active":       "tableActive",
  comment:          "comment",
};

// Pre-build Color3 pairs once at module load so getCellColors() is allocation-free.
const KIND_COLORS: Record<CellKind, CellColors> = {} as Record<CellKind, CellColors>;
for (const [kind, key] of Object.entries(KIND_TO_THEME) as [CellKind, ThemeKey][]) {
  KIND_COLORS[kind] = {
    diffuse:  Color3.FromHexString(C[key].diffuse),
    emissive: Color3.FromHexString(C[key].emissive),
  };
}

export const KIND_GLOW_INTENSITY: Record<CellKind, number> = {} as Record<CellKind, number>;
for (const [kind, key] of Object.entries(KIND_TO_THEME) as [CellKind, ThemeKey][]) {
  KIND_GLOW_INTENSITY[kind] = C[key].glow;
}

export function getCellColors(kind: CellKind): CellColors {
  return KIND_COLORS[kind];
}

export function textColor(kind: CellKind): string {
  return C[KIND_TO_THEME[kind]].glyph;
}
