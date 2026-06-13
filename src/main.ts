import { Sequencer } from "./sequencer/sequencer.js";
import { Scheduler } from "./clock/scheduler.js";
import { MidiOut } from "./midi/midiOut.js";
import { KeyboardInput } from "./input/keyboard.js";
import { loadPatch, patchContentCenter, saveAsFile, uploadPatch, uploadOrca } from "./storage/patches.js";
import { GridAdapter } from "./renderer/gridView.js";
import type { GridView } from "./renderer/gridView.js";
import { Renderer } from "./renderer/renderer.js";

async function main() {
  const canvas = document.getElementById("canvas") as HTMLCanvasElement;

  const seq   = new Sequencer(75, 75, 75);
  const midi  = new MidiOut();
  const sched = new Scheduler(seq, midi);
  const keys  = new KeyboardInput(seq, sched);

  // Start cursor in the centre of the cube
  keys.cursor.x = Math.floor(seq.width  / 2);
  keys.cursor.y = Math.floor(seq.height / 2);
  keys.cursor.z = Math.floor(seq.depth  / 2);

  const grid     = new GridAdapter(seq);
  const renderer = new Renderer(canvas, grid, keys.cursor);

  grid.setCursor(keys.cursor.x, keys.cursor.y, keys.cursor.z);

  renderer.onCellPick  = (x, y, z) => { keys.jumpTo(x, y, z); keys.clearSelection(); };
  grid.onMidiFlash     = (positions) => renderer.flashCells(positions);

  keys.onCursorMove = () => {
    grid.setCursor(keys.cursor.x, keys.cursor.y, keys.cursor.z);
    renderer.updateCursor(keys.cursor);
    updateHUD(seq, keys);
    updateHint(grid, keys);
  };

  keys.onSelectionChange = (sel) => {
    renderer.setSelection(sel);
  };

  keys.onCenterCamera = () => {
    renderer.centerOn(keys.cursor.x, keys.cursor.y, keys.cursor.z);
  };

  keys.getCameraAlpha = () => renderer.getCameraAlpha();

  document.getElementById("btn-save")?.addEventListener("click", () => saveAsFile(seq).catch(() => {}));
  document.getElementById("btn-load")?.addEventListener("click", () => {
    uploadPatch(seq).then(() => focusPatchContent(seq, keys, renderer)).catch(err => console.error("Load failed:", err));
  });
  document.getElementById("btn-load-orca")?.addEventListener("click", () =>
    uploadOrca(seq, keys.cursor.x, keys.cursor.y, keys.cursor.z, keys.cursor.planeMode).catch(() => {})
  );

  const midiOk = await midi.init();
  updateMidiStatus(midiOk, midi.portNames);

  if (loadPatch(seq)) focusPatchContent(seq, keys, renderer);

  setInterval(() => updateHUD(seq, keys), 100);

  console.log("ARPE  |  SPACE=play/stop  [/]=BPM  Tab=toggle XY/ZY  Alt+C=center camera");
}

function updateHUD(seq: Sequencer, keys: KeyboardInput) {
  const mode = keys.cursor.planeMode.toUpperCase();
  setText("bpm-display",    `BPM: ${seq.bpm}`);
  setText("frame-display",  `FRAME: ${seq.frame}`);
  setText("layer-display",  `MODE: ${mode}`);
  setText("cursor-display", `POS: ${keys.cursor.x},${keys.cursor.y},${keys.cursor.z}`);
}

function updateMidiStatus(ok: boolean, names: string[]) {
  const el = document.getElementById("midi-status");
  if (!el) return;
  if (!ok) { el.textContent = "MIDI: unavailable"; el.style.color = "#f55"; return; }
  if (names.length === 0) { el.textContent = "MIDI: no ports"; el.style.color = "#fa5"; return; }
  el.textContent = `MIDI: ${names.join(", ")}`;
  el.style.color = "#5f5";
}

function updateHint(grid: GridView, keys: KeyboardInput) {
  const el = document.getElementById("hint-display");
  if (!el) return;
  el.textContent = grid.getHint(keys.cursor.x, keys.cursor.y, keys.cursor.z) ?? "";
}

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function focusPatchContent(seq: Sequencer, keys: KeyboardInput, renderer: Renderer) {
  const center = patchContentCenter(seq);
  if (!center) return;
  keys.jumpTo(center.x, center.y, center.z);
  keys.clearSelection();
  renderer.centerOn(center.x, center.y, center.z);
}

main().catch(console.error);
