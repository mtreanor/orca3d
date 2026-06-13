import type { GridView } from "./gridView.js";
import type { CursorState, SelectionState } from "../input/keyboard.js";
import { createScene } from "./scene.js";
import { CellPool } from "./cellPool.js";
import { Cursor3D } from "./cursor3d.js";
import { SelectionBox3D } from "./selectionBox3D.js";
import { cellToWorld, CELL_STRIDE, LAYER_STRIDE } from "./layout.js";
import { Vector3, Animation, Scene, ArcRotateCamera, PointerEventTypes, Matrix } from "@babylonjs/core";

const CENTER_RADIUS = 22;

export class Renderer {
  private pool: CellPool;
  private cursor3d: Cursor3D;
  private selectionBox: SelectionBox3D;
  private camera: ArcRotateCamera;
  private scene: Scene;
  private cursorState: CursorState;
  private dims: { width: number; height: number; depth: number };

  onCellPick: ((x: number, y: number, z: number) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    grid: GridView,
    cursorState: CursorState,
  ) {
    const { engine, scene, camera, glow } = createScene(canvas, grid);
    this.camera      = camera;
    this.scene       = scene;
    this.cursorState = cursorState;
    this.dims        = { width: grid.width, height: grid.height, depth: grid.depth };

    this.pool         = new CellPool(scene, glow, grid);
    this.cursor3d     = new Cursor3D(scene);
    this.selectionBox = new SelectionBox3D(scene);

    // Sparse initial render — only visit cells that actually have content.
    grid.eachNonEmptyCell((x, y, z, view) => this.pool.update(x, y, z, view));

    grid.subscribe((x, y, z, view) => this.pool.update(x, y, z, view));

    grid.onDimensionsChange = (dims) => {
      this.dims = dims;
      this.pool.resize(dims);
      this._updateCameraLimits(dims);
    };

    this.cursor3d.setPosition(cursorState.x, cursorState.y, cursorState.z);
    this.pool.setActivePlane(cursorState);

    this._setupClickHandler();

    engine.runRenderLoop(() => {
      this.cursor3d.setPosition(cursorState.x, cursorState.y, cursorState.z);
      this.pool.updateFlashes();
      scene.render();
    });
  }

  updateCursor(cursorState: CursorState) {
    this.cursor3d.setPosition(cursorState.x, cursorState.y, cursorState.z);
    this.pool.setActivePlane(cursorState);
  }

  setSelection(sel: SelectionState | null) {
    if (sel === null) {
      this.selectionBox.hide();
    } else {
      this.selectionBox.setRegion(
        sel.anchor.x, sel.anchor.y, sel.anchor.z,
        sel.cursor.x, sel.cursor.y, sel.cursor.z,
      );
    }
  }

  centerOn(x: number, y: number, z: number) {
    const pos      = cellToWorld(x, y, z);
    const newTarget = new Vector3(pos.x, pos.y, pos.z);
    const frameRate = 60;
    const frames    = 18;

    const targetAnim = new Animation(
      "cameraTarget", "target", frameRate,
      Animation.ANIMATIONTYPE_VECTOR3, Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    targetAnim.setKeys([
      { frame: 0,      value: this.camera.target.clone() },
      { frame: frames, value: newTarget },
    ]);

    const radiusAnim = new Animation(
      "cameraRadius", "radius", frameRate,
      Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CONSTANT,
    );
    radiusAnim.setKeys([
      { frame: 0,      value: this.camera.radius },
      { frame: frames, value: CENTER_RADIUS },
    ]);

    this.camera.animations = [targetAnim, radiusAnim];
    this.scene.beginAnimation(this.camera, 0, frames, false);
  }

  getCameraAlpha(): number {
    return this.camera.alpha;
  }

  flashCells(positions: [number, number, number][]) {
    this.pool.flash(positions);
  }

  private _setupClickHandler() {
    let downX = 0, downY = 0;
    this.scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        downX = info.event.clientX;
        downY = info.event.clientY;
      } else if (info.type === PointerEventTypes.POINTERUP && info.event.button === 0) {
        const dx = info.event.clientX - downX;
        const dy = info.event.clientY - downY;
        if (dx * dx + dy * dy >= 25) return; // drag, not click

        // Prefer hitting a filled cell (operator / argument / etc.)
        const boxCoords = this.pool.pickBox(this.scene.pointerX, this.scene.pointerY);
        if (boxCoords) { this.onCellPick?.(boxCoords[0], boxCoords[1], boxCoords[2]); return; }

        // Fallback: project click onto the active editing plane
        const planeCoords = this._pickOnPlane(this.scene.pointerX, this.scene.pointerY);
        if (planeCoords) this.onCellPick?.(planeCoords[0], planeCoords[1], planeCoords[2]);
      }
    });
  }

  private _pickOnPlane(screenX: number, screenY: number): [number, number, number] | null {
    const ray = this.scene.createPickingRay(screenX, screenY, Matrix.Identity(), this.camera);
    const { planeMode, x: cx, z: cz } = this.cursorState;
    const { width, height, depth } = this.dims;

    let gx: number, gy: number, gz: number;

    if (planeMode === "xy") {
      const dz = ray.direction.z;
      if (Math.abs(dz) < 1e-6) return null;
      const t = (cz * LAYER_STRIDE - ray.origin.z) / dz;
      if (t < 0) return null;
      gx = Math.round((ray.origin.x + t * ray.direction.x) / CELL_STRIDE);
      gy = Math.round(-(ray.origin.y + t * ray.direction.y) / CELL_STRIDE);
      gz = cz;
    } else {
      const dx = ray.direction.x;
      if (Math.abs(dx) < 1e-6) return null;
      const t = (cx * CELL_STRIDE - ray.origin.x) / dx;
      if (t < 0) return null;
      gx = cx;
      gy = Math.round(-(ray.origin.y + t * ray.direction.y) / CELL_STRIDE);
      gz = Math.round((ray.origin.z + t * ray.direction.z) / LAYER_STRIDE);
    }

    return [
      Math.max(0, Math.min(width  - 1, gx)),
      Math.max(0, Math.min(height - 1, gy)),
      Math.max(0, Math.min(depth  - 1, gz)),
    ];
  }

  private _updateCameraLimits(dims: { width: number; height: number; depth: number }) {
    const worldSpan = Math.max(dims.width, dims.height, dims.depth) * CELL_STRIDE;
    this.camera.upperRadiusLimit    = worldSpan * 1.5;
    this.camera.panningDistanceLimit = worldSpan * 0.65;
  }

  dispose() {
    this.pool.dispose();
    this.cursor3d.dispose();
    this.selectionBox.dispose();
  }
}
