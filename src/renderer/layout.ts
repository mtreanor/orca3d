// Pure math: grid coordinates → Babylon world coordinates. No imports.

export const CELL_SIZE    = 0.7;
export const CELL_STRIDE  = 0.85;  // size + gap
export const LAYER_STRIDE = 0.85;  // world units between Z layers (same as cell stride)

export function cellToWorld(x: number, y: number, z: number) {
  return {
    x: x * CELL_STRIDE,
    y: -(y * CELL_STRIDE),  // screen-Y is down, world-Y is up
    z: z * LAYER_STRIDE,
  };
}

export function gridCenter(width: number, height: number, depth: number) {
  return {
    x: ((width - 1) * CELL_STRIDE) / 2,
    y: -(((height - 1) * CELL_STRIDE) / 2),
    z: ((depth - 1) * LAYER_STRIDE) / 2,
  };
}

/** Nearest multiple of `step` to the grid centre, clamped to valid cell indices. */
export function nearestAlignedCoord(gridSize: number, step = 8): number {
  const center = Math.floor(gridSize / 2);
  const aligned = Math.round(center / step) * step;
  return Math.max(0, Math.min(gridSize - 1, aligned));
}

/** Start cursor on an XY slice (z % 8 === 0) at the nearest major grid intersection to centre. */
export function gridStartCursor(width: number, height: number, depth: number) {
  return {
    x: nearestAlignedCoord(width),
    y: nearestAlignedCoord(height),
    z: nearestAlignedCoord(depth),
  };
}

// Opacity of a layer relative to the active layer
export function layerOpacity(z: number, activeZ: number): number {
  const dist = Math.abs(z - activeZ);
  if (dist === 0) return 1.0;
  if (dist === 1) return 0.55;
  if (dist === 2) return 0.28;
  return 0.12;
}
