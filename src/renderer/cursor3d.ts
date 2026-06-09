import {
  Scene, Mesh, MeshBuilder, StandardMaterial, Vector3, Color3,
} from "@babylonjs/core";
import { cellToWorld, CELL_SIZE } from "./layout.js";

export class Cursor3D {
  private mesh: Mesh;

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateBox("cursor", { size: CELL_SIZE * 1.08 }, scene);

    const mat = new StandardMaterial("cursorMat", scene);
    mat.emissiveColor   = new Color3(1, 1, 1);
    mat.wireframe       = true;
    mat.backFaceCulling = false;

    this.mesh.material  = mat;
    this.mesh.isPickable = false;
  }

  setPosition(x: number, y: number, z: number) {
    const pos = cellToWorld(x, y, z);
    this.mesh.position = new Vector3(pos.x, pos.y, pos.z);
  }

  dispose() { this.mesh.dispose(); }
}
