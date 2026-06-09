import type { MidiEvent } from "../sequencer/sequencer.js";

export class MidiOut {
  private outputs: MIDIOutput[] = [];
  private ready = false;

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) return false;
    try {
      const access = await navigator.requestMIDIAccess();
      this._scan(access);
      access.onstatechange = () => this._scan(access);
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  get isReady() { return this.ready; }
  get portCount() { return this.outputs.length; }
  get portNames(): string[] { return this.outputs.map(o => o.name ?? "Unknown"); }

  scheduleNote(evt: MidiEvent, delayMs: number) {
    if (this.outputs.length === 0) return;

    if (evt.durationMs === 0) {
      // CC message: use note as CC number, velocity as value
      setTimeout(() => this._sendCC(evt.channel, evt.note, evt.velocity), delayMs);
      return;
    }

    setTimeout(() => {
      this._sendNoteOn(evt.channel, evt.note, evt.velocity);
      setTimeout(() => this._sendNoteOff(evt.channel, evt.note), evt.durationMs);
    }, delayMs);
  }

  allNotesOff() {
    for (let ch = 0; ch < 16; ch++) {
      for (const out of this.outputs) {
        out.send([0xB0 | ch, 123, 0]); // All Notes Off CC
      }
    }
  }

  private _sendNoteOn(channel: number, note: number, velocity: number) {
    const msg = [0x90 | (channel & 0xF), note & 0x7F, velocity & 0x7F];
    for (const out of this.outputs) out.send(msg);
  }

  private _sendNoteOff(channel: number, note: number) {
    const msg = [0x80 | (channel & 0xF), note & 0x7F, 0];
    for (const out of this.outputs) out.send(msg);
  }

  private _sendCC(channel: number, cc: number, value: number) {
    const msg = [0xB0 | (channel & 0xF), cc & 0x7F, value & 0x7F];
    for (const out of this.outputs) out.send(msg);
  }

  private _scan(access: MIDIAccess) {
    this.outputs = [];
    access.outputs.forEach((out: MIDIOutput) => {
      const name = out.name ?? "";
      if (!name.includes("Through") && !name.includes("RtMidi")) {
        this.outputs.push(out);
      }
    });
  }
}
