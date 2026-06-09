# ARPE — 3D Orca

Based on [Orca by Hundred Rabbits](https://100r.co/site/orca.html).

A browser port of that project, extended from a 2D grid into a **3D cell space**. The project is **in active development** — behaviour and APIs may change.

Orca is a livecoding environment where every letter is an operator and lowercase letters are data values (base-36). On each sixteenth-note frame, operators read neighbouring cells and write results to their output slots. This port keeps that model but stacks cells in depth so patterns can reach across layers.

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server at http://localhost:3000
npm run build    # typecheck + production bundle → dist/
npm run preview  # serve the production build
```

MIDI output uses the [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API). You need a browser that supports it and a connected MIDI interface.

## Implementation

| Layer | Technology |
|-------|------------|
| 3D view | [Babylon.js 7](https://doc.babylonjs.com/) — instanced cube grid, dynamic glyph textures, orbit camera |
| Sequencer engine | TypeScript — no rendering dependency; ported from the Unity/C# ARPE-2 reference |
| Timing | Web Audio API lookahead clock (~25 ms interval) |
| MIDI | Web MIDI API |
| Bundler | Vite 5 |

Source layout:

```
src/
├── sequencer/     # grid engine and operators
├── renderer/      # Babylon.js scene, grid mesh, cursor
├── clock/         # frame scheduler
├── midi/          # MIDI output
├── input/         # keyboard navigation and editing
└── storage/       # patch save/load (localStorage + file)
```

## How 3D differs from Orca

The 2D Orca grid becomes a `width × height × depth` volume (currently **50 × 50 × 50** in `main.ts`). Coordinates: **x** = right, **y** = down, **z** = depth.

### Operator geometry

- **Output is always down** — every operator writes to `(0, +1, 0)` relative to itself. This offset does not rotate.
- **Inputs rotate in the horizontal plane** — standard two-input operators read from left `(−1, 0, 0)` and right `(+1, 0, 0)`. `Alt+←` / `Alt+→` rotate the operator 90° around Y so inputs can reach into adjacent depth layers. There is no Z-axis tilt.
- **Table operators** (`T`, `G`, `K`, `P`, `Q`) spread their variable-length arms along the operator's `forward` vector, so rotating moves the whole table into depth.
- **Glyph feedback** — at 180° the character is mirrored horizontally; at 90°/270° it is rotated on the cube face.

### Values

All numeric values are **base-36** integers (`0–9`, `a–z` → 0–35), matching Orca.

---

## Operators

Base operators are present in every Orca port. Descriptions below follow the [Orca operator reference](https://100r.co/site/orca.html). Where this 3D port differs, notes are in the **ARPE-3D** column.

### Base operators (A–Z)

| | Orca | ARPE-3D |
|---|------|---------|
| **A** | **add** (*a* *b*): Outputs sum of inputs. | Same. Inputs left/right; output below. |
| **B** | **subtract** (*a* *b*): Outputs difference of inputs. | Outputs **\|b − a\|** (absolute difference) for bounce/wrap patterns. |
| **C** | **clock** (*rate* *mod*): Outputs modulo of frame. | Same. |
| **D** | **delay** (*rate* *mod*): Bangs on modulo of frame. | Same — writes `*` to the cell below. |
| **E** | **east**: Moves eastward, or bangs. | Mover along **+x**. Bangs on collision. |
| **F** | **if** (*a* *b*): Bangs if inputs are equal. | Same. |
| **G** | **generator** (*x* *y* *len*): Writes operands with offset. | **3D:** adds **z** offset — `(*x* *y* *z* *len*)`. Table arm follows `forward`. |
| **H** | **halt**: Halts southward operand. | Holds adjacent movers and prevents `*` from clearing. |
| **I** | **increment** (*step* *mod*): Increments southward operand. | Same — accumulates into output below, wraps at *mod*. |
| **J** | **jumper** (*val*): Outputs northward operand. | Passes the cell **above** `(0, −1, 0)` to the output below. |
| **K** | **konkat** (*len*): Reads multiple variables. | Same role. Table arm follows `forward`. |
| **L** | **lesser** (*a* *b*): Outputs smallest of inputs. | Same — `min(a, b)`. |
| **M** | **multiply** (*a* *b*): Outputs product of inputs. | Same. |
| **N** | **north**: Moves northward, or bangs. | Mover along **−y** (up on the grid). |
| **O** | **read** (*x* *y* *read*): Reads operand with offset. | **3D:** adds **z** — `(*x* *y* *z*)`. |
| **P** | **push** (*len* *key* *val*): Writes eastward operand. | Same role. Distributes *val* to table slot *key*. |
| **Q** | **query** (*x* *y* *len*): Reads operands with offset. | **3D:** adds **z** — `(*x* *y* *z* *len*)`. Table arm follows `forward`. |
| **R** | **random** (*min* *max*): Outputs random value. | Deterministic seeded LCG per cell position. Swaps *min*/*max* if reversed. |
| **S** | **south**: Moves southward, or bangs. | Mover along **+y** (down on the grid). |
| **T** | **track** (*key* *len* *val*): Reads eastward operand. | Same role — reads table slot at index *key* % *len*. Table arm follows `forward`. |
| **U** | **uclid** (*step* *max*): Bangs on Euclidean rhythm. | Same. |
| **V** | **variable** (*write* *read*): Reads and writes variable. | Same — sole variable operator in this port. |
| **W** | **variable** (*write* *read*): Reads and writes variable. | **Repurposed:** **west mover** along **−x**. Variables use **V** only. |
| **X** | **write** (*x* *y* *val*): Writes operand with offset. | **3D:** adds **z** — `(*x* *y* *z* *val*)`. |
| **Y** | **jymper** (*val*): Outputs westward operand. | Passes the cell to the **left** to the cell on the **right** (horizontal, same row). |
| **Z** | **lerp** (*rate* *target*): Transitions operand to input. | Same — slew/glide toward *target* at *rate* steps per frame. |

### Special operators

| | Orca | ARPE-3D |
|---|------|---------|
| **\*** | **bang**: Bangs neighboring operands. | Same. Cleared each frame unless adjacent to **H**. MIDI operators fire when touching a bang. |
| **:** | **midi** (*ch* *oct* *note* *velocity*\*): Send a MIDI note. | Implemented via Web MIDI. Velocity maps 0–35 → 0–127 (empty = 100). Optional duration in sixteenths. |
| **!** | **midi cc** (*ch* *knob* *val*): Send a MIDI control change. | Implemented via Web MIDI. CC value maps 0–35 → 0–127. |

### Not yet implemented

These Orca platform operators are not in this port:

| | Orca |
|---|------|
| **$** | **self** (*cmd*): Send a command to Orca. |
| **;** | **pitch** (*oct* *note*): Send pitch byte out. |
| **/** | **byte** (*high* *low*): Send a raw byte. |
| **=** | **play** (*ch* *oct* *note* *velocity*\*): Play note with built-in synth. |
| **#** | **comment**: Halts a line. |

---

## Base-36 table

| | 0–9 | A–F | G–L | M–R | S–X | Y–Z |
|---|-----|-----|-----|-----|-----|-----|
| Value | 0–9 | 10–15 | 16–21 | 22–27 | 28–33 | 34–35 |

---

## Credits

- [Orca by Hundred Rabbits](https://100r.co/site/orca.html)
- This port: ARPE-2 browser implementation (TypeScript + Babylon.js)
