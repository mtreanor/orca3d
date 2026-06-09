import { DynamicTexture, Scene } from "@babylonjs/core";
import type { CellKind, CellFacing } from "./gridView.js";
import { textColor } from "./cellColors.js";

const TEX_SIZE = 128;

const cache = new Map<string, DynamicTexture>();

export function getCharTexture(
  value: string,
  kind: CellKind,
  _facing: CellFacing | undefined,
  scene: Scene,
): DynamicTexture {
  if (value === "") return getEmptyTexture(scene);
  const key = `${value}|${kind}`;
  let tex = cache.get(key);
  if (tex) return tex;

  tex = new DynamicTexture(`ct_${key}`, { width: TEX_SIZE, height: TEX_SIZE }, scene, false);
  tex.hasAlpha = false;

  const ctx  = tex.getContext() as unknown as CanvasRenderingContext2D;
  const half = TEX_SIZE / 2;

  ctx.fillStyle = "#000008";
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  ctx.fillStyle    = textColor(kind);
  ctx.font         = `bold ${Math.floor(TEX_SIZE * 0.65)}px monospace`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(TEX_SIZE, 0);
  ctx.scale(-1, 1);
  ctx.fillText(value[0], half, half + 2);
  ctx.restore();

  tex.update();
  cache.set(key, tex);
  return tex;
}

export function getEmptyTexture(scene: Scene): DynamicTexture {
  const key = "__empty__";
  let tex = cache.get(key);
  if (tex) return tex;
  tex = new DynamicTexture(`ct_empty`, { width: 8, height: 8 }, scene, false);
  const ctx = tex.getContext();
  ctx.fillStyle = "#000008";
  ctx.fillRect(0, 0, 8, 8);
  tex.update();
  cache.set(key, tex);
  return tex;
}

export function clearCache() {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
}
