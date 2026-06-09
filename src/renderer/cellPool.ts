import {
  Scene, Mesh, MeshBuilder, StandardMaterial, GlowLayer, Color3,
  InstancedMesh, Vector3,
} from "@babylonjs/core";
import type { CellView, GridDimensions } from "./gridView.js";
import type { CursorState } from "../input/keyboard.js";
import { cellToWorld, layerOpacity, CELL_SIZE } from "./layout.js";
import { getCellColors, KIND_GLOW_INTENSITY } from "./cellColors.js";
import { getCharTexture } from "./textureCache.js";

const GHOST_SIZE   = CELL_SIZE * 0.35;
const PLANE_SIZE   = CELL_SIZE * 0.9;
const PLANE_OFFSET = CELL_SIZE / 2 * 1.01;

// Same face order as the snippet: front (+Z), left (-X), back (-Z), right (+X)
const FACE_ROTATIONS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const FACE_POSITIONS = [
  new Vector3(0,             0, PLANE_OFFSET),
  new Vector3(-PLANE_OFFSET, 0, 0),
  new Vector3(0,             0, -PLANE_OFFSET),
  new Vector3(PLANE_OFFSET,  0, 0),
];

export class CellPool {
  private scene: Scene;
  private glow:  GlowLayer;
  private dims:  GridDimensions;

  // Ghost cells → small wireframe box
  private ghostMeshes = new Map<string, Mesh>();
  private ghostMats   = new Map<string, StandardMaterial>();

  // Non-ghost cells → full-size box + 4 oriented character planes
  private boxMeshes = new Map<string, Mesh>();
  private boxMats   = new Map<string, StandardMaterial>();
  private boxPlanes = new Map<string, Mesh[]>();
  private planeMats = new Map<string, StandardMaterial[]>();

  // Active plane state
  private planeMode:  CursorState["planeMode"] = "xy";
  private sliceIndex = 0;

  // MIDI flash overlays
  private flashEntries = new Map<string, { mesh: Mesh; mat: StandardMaterial; startTime: number }>();
  private static readonly FLASH_DURATION = 400;

  // Background grid
  private bgMaster:    Mesh | null          = null;
  private bgMat:       StandardMaterial | null = null;
  private bgInstances: InstancedMesh[]      = [];

  constructor(scene: Scene, glow: GlowLayer, dims: GridDimensions) {
    this.scene = scene;
    this.glow  = glow;
    this.dims  = dims;
    this._buildBackgroundGrid();
  }

  update(x: number, y: number, z: number, view: CellView) {
    const key = `${x},${y},${z}`;

    if (view.kind === "empty") { this._remove(key); return; }

    const isGhost = view.kind === "ghost" || view.kind === "ghost-left" || view.kind === "ghost-right";
    const alpha   = this._cellAlpha(x, z);
    const colors  = getCellColors(view.kind);
    const pos     = cellToWorld(x, y, z);

    if (isGhost) {
      if (this.boxMeshes.has(key)) this._removeBox(key);

      let mesh = this.ghostMeshes.get(key);
      let mat  = this.ghostMats.get(key);
      if (!mesh || !mat) {
        mesh = MeshBuilder.CreateBox(`ghost_${key}`, { size: GHOST_SIZE }, this.scene);
        mat  = new StandardMaterial(`ghostMat_${key}`, this.scene);
        mesh.material = mat;
        this.ghostMeshes.set(key, mesh);
        this.ghostMats.set(key, mat);
      }
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.metadata       = { kind: view.kind };
      mat.diffuseColor    = colors.diffuse;
      mat.emissiveColor   = colors.emissive.scale(alpha);
      mat.alpha           = 1.0;
      mat.wireframe       = true;
      mat.backFaceCulling = false;

    } else {
      if (this.ghostMeshes.has(key)) this._removeGhost(key);

      let mesh   = this.boxMeshes.get(key);
      let mat    = this.boxMats.get(key);
      let planes = this.boxPlanes.get(key);
      let pmats  = this.planeMats.get(key);
      if (!mesh || !mat) {
        mesh = MeshBuilder.CreateBox(`box_${key}`, { size: CELL_SIZE }, this.scene);
        mesh.isPickable = false;
        mat = new StandardMaterial(`boxMat_${key}`, this.scene);
        mesh.material = mat;
        this.boxMeshes.set(key, mesh);
        this.boxMats.set(key, mat);

        planes = [];
        pmats  = [];
        for (let i = 0; i < 4; i++) {
          const plane = MeshBuilder.CreatePlane(`face_${key}_${i}`, { size: PLANE_SIZE }, this.scene);
          plane.parent     = mesh;
          plane.position   = FACE_POSITIONS[i].clone();
          plane.rotation.y = FACE_ROTATIONS[i];
          plane.isPickable = false;
          if (i === 1 || i === 3) plane.scaling.x = -1;  // side faces need an extra horizontal flip
          const pmat = new StandardMaterial(`planeMat_${key}_${i}`, this.scene);
          pmat.backFaceCulling = false;
          plane.material = pmat;
          planes.push(plane);
          pmats.push(pmat);
        }
        this.boxPlanes.set(key, planes);
        this.planeMats.set(key, pmats);
      }

      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.metadata = { kind: view.kind };

      const charTex = getCharTexture(view.value, view.kind, view.facing, this.scene);
      for (let i = 0; i < 4; i++) {
        pmats![i].diffuseTexture = charTex;
        pmats![i].alpha          = alpha;
      }

      mat.diffuseColor  = colors.diffuse;
      mat.emissiveColor = colors.emissive.scale(alpha);
      mat.alpha         = alpha;
      mat.wireframe     = false;

      const glowStrength = KIND_GLOW_INTENSITY[view.kind];
      if (glowStrength > 0) this.glow.addIncludedOnlyMesh(mesh);
      else                  this.glow.removeIncludedOnlyMesh(mesh);
    }
  }

  setActivePlane(cursor: CursorState) {
    const newMode  = cursor.planeMode;
    const newSlice = newMode === "xy" ? cursor.z : cursor.x;
    if (newMode === this.planeMode && newSlice === this.sliceIndex) return;
    this.planeMode  = newMode;
    this.sliceIndex = newSlice;
    this._repositionBackground();
    this._refreshAllOpacities();
  }

  dispose() {
    for (const key of [...this.ghostMeshes.keys()]) this._removeGhost(key);
    for (const key of [...this.boxMeshes.keys()])   this._removeBox(key);
    for (const inst of this.bgInstances) inst.dispose();
    this.bgMaster?.dispose();
    this.bgMat?.dispose();
    this.bgInstances = [];
    this.bgMaster    = null;
    this.bgMat       = null;
  }

  flash(positions: [number, number, number][]) {
    const now = Date.now();
    for (const [x, y, z] of positions) {
      const key = `${x},${y},${z}`;
      const existing = this.flashEntries.get(key);
      if (existing) {
        existing.startTime = now;
      } else {
        const pos = cellToWorld(x, y, z);
        const mesh = MeshBuilder.CreateBox(`fl_${key}`, { size: CELL_SIZE * 1.02 }, this.scene);
        const mat  = new StandardMaterial(`flMat_${key}`, this.scene);
        mat.diffuseColor    = new Color3(0, 0, 0);
        mat.emissiveColor   = new Color3(0.9, 0.75, 0.05);
        mat.alpha           = 0;
        mat.backFaceCulling = false;
        mesh.material   = mat;
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.isPickable = false;
        this.flashEntries.set(key, { mesh, mat, startTime: now });
      }
    }
  }

  updateFlashes() {
    const now     = Date.now();
    const expired: string[] = [];
    for (const [key, entry] of this.flashEntries) {
      const t = (now - entry.startTime) / CellPool.FLASH_DURATION;
      if (t >= 1) {
        expired.push(key);
      } else {
        entry.mat.alpha = 0.5 * (1 - t);
      }
    }
    for (const key of expired) {
      const e = this.flashEntries.get(key)!;
      e.mesh.dispose();
      e.mat.dispose();
      this.flashEntries.delete(key);
    }
  }

  pickBox(screenX: number, screenY: number): [number, number, number] | null {
    for (const m of this.boxMeshes.values()) m.isPickable = true;
    const pick = this.scene.pick(screenX, screenY, m => m.name.startsWith("box_"));
    for (const m of this.boxMeshes.values()) m.isPickable = false;

    const name = pick?.pickedMesh?.name;
    if (!name) return null;
    const parts = name.slice(4).split(",").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return [parts[0], parts[1], parts[2]];
  }

  // ---- private ----

  private _cellAlpha(x: number, z: number): number {
    const coord = this.planeMode === "xy" ? z : x;
    return layerOpacity(coord, this.sliceIndex);
  }

  private _refreshAllOpacities() {
    for (const [key, mesh] of this.ghostMeshes.entries()) {
      const [cx, , cz] = key.split(",").map(Number);
      const mat   = this.ghostMats.get(key) as StandardMaterial;
      const alpha = this._cellAlpha(cx, cz);
      const kind  = mesh.metadata?.kind;
      if (kind) mat.emissiveColor = getCellColors(kind).emissive.scale(alpha);
    }
    for (const [key, mesh] of this.boxMeshes.entries()) {
      const [cx, , cz] = key.split(",").map(Number);
      const mat   = this.boxMats.get(key) as StandardMaterial;
      const alpha = this._cellAlpha(cx, cz);
      const kind  = mesh.metadata?.kind;
      mat.alpha = alpha;
      if (kind) mat.emissiveColor = getCellColors(kind).emissive.scale(alpha);
      const pmats = this.planeMats.get(key);
      if (pmats) for (const pmat of pmats) pmat.alpha = alpha;
    }
  }

  private _remove(key: string) {
    this._removeGhost(key);
    this._removeBox(key);
  }

  private _removeGhost(key: string) {
    const mesh = this.ghostMeshes.get(key);
    const mat  = this.ghostMats.get(key);
    if (mesh) { mesh.dispose();  this.ghostMeshes.delete(key); }
    if (mat)  { mat.dispose();   this.ghostMats.delete(key); }
  }

  private _removeBox(key: string) {
    const planes = this.boxPlanes.get(key);
    const pmats  = this.planeMats.get(key);
    if (planes) { for (const p of planes) p.dispose();  this.boxPlanes.delete(key); }
    if (pmats)  { for (const pm of pmats) pm.dispose(); this.planeMats.delete(key); }
    const mesh = this.boxMeshes.get(key);
    const mat  = this.boxMats.get(key);
    if (mesh) { this.glow.removeIncludedOnlyMesh(mesh); mesh.dispose(); this.boxMeshes.delete(key); }
    if (mat)  { mat.dispose(); this.boxMats.delete(key); }
  }

  private _buildBackgroundGrid() {
    const DOT = 0.22;
    this.bgMat = new StandardMaterial("bgMat", this.scene);
    this.bgMat.diffuseColor    = new Color3(0.10, 0.12, 0.20);
    this.bgMat.emissiveColor   = new Color3(0.03, 0.04, 0.08);
    this.bgMat.alpha           = 0.18;
    this.bgMat.backFaceCulling = false;

    this.bgMaster = MeshBuilder.CreateBox("bgMaster", { size: DOT }, this.scene);
    this.bgMaster.material  = this.bgMat;
    this.bgMaster.isPickable = false;
    this.bgMaster.isVisible  = false;

    const maxSide = Math.max(this.dims.width, this.dims.depth);
    const count   = maxSide * this.dims.height;
    for (let i = 0; i < count; i++) {
      const inst = this.bgMaster.createInstance(`bgDot_${i}`);
      inst.isPickable = false;
      this.bgInstances.push(inst);
    }
    this._repositionBackground();
  }

  private _repositionBackground() {
    const { width, height, depth } = this.dims;
    const sliceA = this.planeMode === "xy" ? width : depth;

    let i = 0;
    for (let a = 0; a < sliceA; a++) {
      for (let b = 0; b < height; b++) {
        const p = this.planeMode === "xy"
          ? cellToWorld(a, b, this.sliceIndex)
          : cellToWorld(this.sliceIndex, b, a);
        this.bgInstances[i].position.set(p.x, p.y, p.z);
        this.bgInstances[i].isVisible = true;
        i++;
      }
    }
    for (; i < this.bgInstances.length; i++) this.bgInstances[i].isVisible = false;
  }
}
