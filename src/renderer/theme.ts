// ─────────────────────────────────────────────────────────────────────────────
// theme.ts — single source of truth for all renderer colors.
//
// Edit values here; nothing else needs to change.
// All colors are CSS hex strings (#rrggbb). Babylon Color3/Color4 objects are
// constructed from these strings inside the individual renderer files.
// ─────────────────────────────────────────────────────────────────────────────

export const THEME = {

  // ── Canvas / scene ────────────────────────────────────────────────────────
  sceneBackground:      "#0a0a14",   // canvas clear color (alpha is always 1)
  ambientSkyColor:      "#b3ccff",   // top hemisphere of the ambient light
  ambientGroundColor:   "#1a1a33",   // bottom hemisphere of the ambient light

  // ── UI overlays ───────────────────────────────────────────────────────────
  cursor:               "#ffffff",   // cursor wireframe
  selectionBox:         "#33e6ff",   // selection region wireframe
  midiFlashDiffuse:     "#000000",   // flash box surface (kept dark so only the glow is visible)
  midiFlashEmissive:    "#99800d",   // glow pulse when a MIDI note fires

  // ── Background reference grid dots ───────────────────────────────────────
  gridDotDiffuse:       "#1a1f33",
  gridDotEmissive:      "#080a14",
  gridDotAlpha:         0.18,
  gridDotMajorAlpha:    0.32,

  // ── Glyph texture background (canvas fill behind each character) ─────────
  textureBackground:    "#000008",

  // ── Per-kind cell appearance ──────────────────────────────────────────────
  // diffuse  : surface color as seen under lighting
  // emissive : self-illumination; also what the GlowLayer samples
  // glyph    : text color rendered on the face texture
  // glow     : GlowLayer intensity multiplier (0 = no glow)
  cells: {
    empty:          { diffuse: "#0d0d1a", emissive: "#000000", glyph: "#ffffff", glow: 0    },
    ghost:          { diffuse: "#2a3a5a", emissive: "#0a0f24", glyph: "#4466aa", glow: 0    },
    ghostPortLeft:  { diffuse: "#cc3333", emissive: "#e61414", glyph: "#4466aa", glow: 0    },
    ghostPortRight: { diffuse: "#33cc55", emissive: "#14e638", glyph: "#4466aa", glow: 0    },
    operator:       { diffuse: "#ffffff", emissive: "#474d5c", glyph: "#ffffff", glow: 0.25 },
    mover:          { diffuse: "#aaffcc", emissive: "#2e5c42", glyph: "#ffffff", glow: 0.25 },
    hold:           { diffuse: "#ccaaff", emissive: "#3d2e61", glyph: "#ffffff", glow: 0.22 },
    midi:           { diffuse: "#55ccff", emissive: "#1f4d70", glyph: "#ffffff", glow: 0.30 },
    bang:           { diffuse: "#ffdd66", emissive: "#614d0f", glyph: "#ffee88", glow: 0.35 },
    bangOutput:     { diffuse: "#ff5555", emissive: "#700f0f", glyph: "#ff8888", glow: 0.40 },
    argument:       { diffuse: "#000008", emissive: "#14141a", glyph: "#ffffff", glow: 0.35 },
    argumentLeft:   { diffuse: "#000008", emissive: "#2e0808", glyph: "#ffcccc", glow: 0.55 },
    argumentRight:  { diffuse: "#000008", emissive: "#082e0f", glyph: "#ccffdd", glow: 0.55 },
    output:         { diffuse: "#000008", emissive: "#0d1f2e", glyph: "#ccf0ff", glow: 0.45 },
    tableActive:    { diffuse: "#151520", emissive: "#33333d", glyph: "#ffffff", glow: 0.40 },
    comment:        { diffuse: "#0c0d0f", emissive: "#0a0d0f", glyph: "#3a4a55", glow: 0    },
  },

} as const;
