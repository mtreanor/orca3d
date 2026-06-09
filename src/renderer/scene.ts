import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, GlowLayer,
  Vector3, Color3, Color4,
} from "@babylonjs/core";
import { gridCenter } from "./layout.js";
import type { GridDimensions } from "./gridView.js";

export interface ArpeSceneObjects {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  glow: GlowLayer;
}

export function createScene(canvas: HTMLCanvasElement, dims: GridDimensions): ArpeSceneObjects {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene  = new Scene(engine);

  scene.clearColor = new Color4(0.04, 0.04, 0.08, 1.0);

  const center = gridCenter(dims.width, dims.height, dims.depth);
  const target = new Vector3(center.x, center.y, center.z);

  const camera = new ArcRotateCamera("cam", -Math.PI * 0.35, Math.PI * 0.38, 32, target, scene);
  camera.lowerRadiusLimit    = 5;
  camera.upperRadiusLimit    = 60;
  camera.lowerBetaLimit      = 0.1;          // prevent flipping under the grid
  camera.upperBetaLimit      = Math.PI * 0.9;
  camera.panningDistanceLimit = 30;          // can't pan more than 30 units from center
  camera.panningOriginTarget  = target.clone();
  camera.panningInertia       = 0.5;         // decelerate faster (default is 0.9)
  camera.attachControl(canvas, true);

  // Remove keyboard so arrow keys stay free for the cursor
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

  // Remove Babylon's wheel handler — we replace it with our own below
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

  // Two-finger touch drag → pan (covers touch screens)
  camera.panningSensibility = 50;

  _setupWheel(camera, canvas);

  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.4;
  ambient.diffuse     = new Color3(0.7, 0.8, 1.0);
  ambient.groundColor = new Color3(0.1, 0.1, 0.2);

  const glow = new GlowLayer("glow", scene);
  glow.intensity = 0.25;

  window.addEventListener("resize", () => engine.resize());

  return { engine, scene, camera, glow };
}

function _setupWheel(camera: ArcRotateCamera, canvas: HTMLCanvasElement) {
  // Mouse drag (left button) = rotate — Babylon default, nothing to do.
  //
  // Wheel event routing:
  //   ctrlKey = true  → pinch gesture (macOS trackpad) → zoom
  //   deltaX  ≠ 0     → two-finger scroll (trackpad) → pan
  //   otherwise       → mouse scroll wheel → zoom

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();

    if (e.ctrlKey) {
      // Pinch gesture (macOS sends ctrlKey=true) → zoom
      camera.inertialRadiusOffset -= e.deltaY * 0.03;
    } else if (e.deltaMode === 0) {
      // Pixel-precision event = trackpad two-finger scroll → pan
      const scale = camera.radius * 0.0004;
      camera.inertialPanningX += e.deltaX * scale;
      camera.inertialPanningY -= e.deltaY * scale;
    } else {
      // Line/page delta = physical mouse wheel → zoom
      camera.inertialRadiusOffset -= e.deltaY * 0.03;
    }
  }, { passive: false });
}

export async function tryEnterAR(scene: Scene): Promise<boolean> {
  try {
    const { WebXRDefaultExperience } = await import("@babylonjs/core");
    const xr = await WebXRDefaultExperience.CreateAsync(scene, {
      uiOptions: { sessionMode: "immersive-ar" },
      optionalFeatures: true,
    });
    return xr.baseExperience.state !== 0;
  } catch {
    return false;
  }
}
