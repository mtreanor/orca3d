import type { Sequencer, MidiEvent } from "../sequencer/sequencer.js";
import type { MidiOut } from "../midi/midiOut.js";

// Lookahead scheduler: uses Web Audio clock for accurate timing, avoids setTimeout drift.
// Fires every INTERVAL_MS, schedules any ticks that fall within the next LOOKAHEAD_MS.
const INTERVAL_MS  = 25;
const LOOKAHEAD_MS = 100;

export class Scheduler {
  private ctx: AudioContext;
  private seq: Sequencer;
  private midi: MidiOut;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextTickTime = 0; // Web Audio time (seconds) of the next sequencer tick
  private running = false;

  constructor(seq: Sequencer, midi: MidiOut) {
    this.ctx  = new AudioContext();
    this.seq  = seq;
    this.midi = midi;
  }

  start() {
    if (this.running) return;
    this.running = true;
    // Resume the AudioContext (browsers require a user gesture before first resume)
    this.ctx.resume();
    this.nextTickTime = this.ctx.currentTime;
    this.intervalId = setInterval(() => this._schedule(), INTERVAL_MS);
  }

  stop() {
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  get isRunning() { return this.running; }

  private _schedule() {
    const lookaheadUntil = this.ctx.currentTime + LOOKAHEAD_MS / 1000;

    while (this.nextTickTime < lookaheadUntil) {
      this._fireTick(this.nextTickTime);
      const sixteenth = this.seq.sixteenth / 1000; // ms → seconds
      this.nextTickTime += sixteenth;
    }
  }

  private _fireTick(scheduledTime: number) {
    this.seq.tick();

    const events: MidiEvent[] = this.seq.drainMidi();
    for (const evt of events) {
      const delayMs = Math.max(0, (scheduledTime - this.ctx.currentTime) * 1000);
      this.midi.scheduleNote(evt, delayMs);
    }
  }
}
