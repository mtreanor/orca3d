import {
  Scene, Mesh, MeshBuilder, StandardMaterial, Vector3, Color3,
} from "@babylonjs/core";
import { cellToWorld, CELL_SIZE, CELL_STRIDE, LAYER_STRIDE } from "./layout.js";
import { THEME } from "./theme.js";

export class SelectionBox3D {
  private mesh: Mesh;

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateBox("selectionBox", { size: 1 }, scene);

    const mat = new StandardMaterial("selectionBoxMat", scene);
    mat.emissiveColor   = Color3.FromHexString(THEME.selectionBox);
    mat.wireframe       = true;
    mat.backFaceCulling = false;

    this.mesh.material  = mat;
    this.mesh.isPickable = false;
    this.mesh.isVisible  = false;
  }

  setRegion(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by), maxY = Math.max(ay, by);
    const minZ = Math.min(az, bz), maxZ = Math.max(az, bz);

    const a = cellToWorld(minX, minY, minZ);
    const b = cellToWorld(maxX, maxY, maxZ);

    this.mesh.position = new Vector3(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2,
    );
    this.mesh.scaling = new Vector3(
      (maxX - minX) * CELL_STRIDE + CELL_SIZE * 1.08,
      (maxY - minY) * CELL_STRIDE + CELL_SIZE * 1.08,
      (maxZ - minZ) * LAYER_STRIDE + CELL_SIZE * 1.08,
    );
    this.mesh.isVisible = true;
  }

  hide() {
    this.mesh.isVisible = false;
  }

  dispose() { this.mesh.dispose(); }
}
