---
name: MD Tools
description: A backstage mixing console for music directors — precise DAW telemetry with a mascot who still cracks jokes between cues.
colors:
  canvas: "#0c121e"
  ink: "#f8fafc"
  surface-rack: "#131b2e"
  surface-strip: "#1a243b"
  surface-dock: "#232f4c"
  orchestral-brass: "#d4a359"
  orchestral-brass-hover: "#e5b869"
  orchestral-brass-muted: "#946c2d"
  on-brass: "#241a04"
  phosphor-emerald: "#2dd4bf"
  studio-cyan: "#38bdf8"
  muted-slate: "#94a3b8"
  ruby-alert: "#f43f5e"
  hairline: "rgba(255,255,255,0.08)"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.4rem"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
  telemetry:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  hardware: "0.25rem"
  panel: "0.5rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.orchestral-brass}"
    textColor: "{colors.on-brass}"
    rounded: "{rounded.hardware}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.orchestral-brass-hover}"
    rounded: "{rounded.hardware}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hardware}"
  card:
    backgroundColor: "{colors.surface-rack}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  telemetry-readout:
    backgroundColor: "{colors.surface-rack}"
    textColor: "{colors.ink}"
    typography: "{typography.telemetry}"
    rounded: "{rounded.hardware}"
    padding: "6px 12px"
---

# Design System: MD Tools

## 1. Overview

**Creative North Star: "The Backstage Console"**

MD Tools is a real mixing console at soundcheck: brass-and-gold transport controls, cyan waveform telemetry, and a crew that still cracks jokes between cues. It is not a generic SaaS admin panel and it is not a cold, silent instrument — it's a precision tool with a personality, the way a touring sound engineer runs a tight board and still has a mascot sticker on the flight case. The system explicitly rejects the cookie-cutter card-grid dashboard look (PRODUCT.md's stated anti-reference) and rejects sterile enterprise tooling with no character.

Density stays console-tight where it matters (the analyzer telemetry strip, the mixer channel strips) and opens up to plain-language breathing room everywhere a first-time user needs orientation. Personality lives at the edges — mascot reactions, a rotating-message tip jar, an animated GIF while a job is queued — never inside the controls themselves, which stay legible and exact.

**Key Characteristics:**
- Dark obsidian canvas, permanently — this is a console, consoles don't have a light mode.
- Brass/gold is the one warm accent; teal and cyan are cold signal colors, never decorative.
- Every numeric readout (BPM, timecodes, key) is monospace with tabular figures — it must never jitter.
- Delight (mascot, tip jar, playful copy) is confined to secondary moments: toasts, empty states, success/error states, loading states.

## 2. Colors

The palette is Restrained-to-Committed: a near-black neutral scale carries the whole surface, with exactly one warm accent (brass) and two cold signal colors (teal, cyan) that are used only to mean something specific, never as generic UI paint.

### Primary
- **Orchestral Brass** (#d4a359): the conductor's baton. Reserved for primary buttons, active tab state, focus rings, and the tempo readout's accent dot. Hover state lightens to **Brass Hover** (#e5b869); disabled/structural framing uses **Brass Muted** (#946c2d) at low opacity for hairline borders.

### Secondary
- **Phosphor Emerald** (#2dd4bf): signals "safe" — engaged solo state on a stem channel, the time-signature telemetry dot, success toasts (paired with the happy mascot). Never used as a button color; it's a status signal, not a UI accent.

### Tertiary
- **Studio Cyan** (#38bdf8): signals motion and signal-flow — waveform progress fill, the key telemetry dot, playhead cursors. This is the "something is actively happening" color.

### Neutral
- **Canvas** (#0c121e): the base page background. Never pure black; this is the deepest tier.
- **Surface Rack** (#131b2e): cards, panels, the first elevation step off the canvas.
- **Surface Strip** (#1a243b): secondary surfaces, hover states, muted backgrounds — the second elevation step.
- **Surface Dock** (#232f4c): popovers, dropdown menus, dialogs — the highest elevation step before a true modal veil.
- **Ink** (#f8fafc): primary text on every dark surface.
- **Muted Slate** (#94a3b8): secondary text, captions, inactive labels.
- **Hairline** (rgba(255,255,255,0.08)): the only border color at rest; never a heavier stroke.
- **Ruby Alert** (#f43f5e): errors only, paired with the sad mascot.

### Named Rules
**The Signal, Not Decoration Rule.** Teal and cyan never appear as generic accent color on a button, badge, or link "just because it looks nice." Teal means safe/engaged (solo, success). Cyan means active/in-motion (waveform, playhead, key). If a use doesn't map to one of those meanings, it should be brass, ink, or muted slate instead.

## 3. Typography

**Display Font:** Space Grotesk (with ui-sans-serif, system-ui fallback)
**Body Font:** Manrope (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace fallback), always with `font-variant-numeric: tabular-nums` on live-updating values

**Character:** Space Grotesk gives headings a geometric, slightly industrial edge (console module labels, not a friendly blog headline); Manrope stays warm and humanist for anything conversational (instructions, toasts, tip-jar copy); JetBrains Mono is reserved entirely for numbers that move — BPM, timecodes, dB-style readouts — so precision reads as precision.

### Hierarchy
- **Display** (600, 1.5rem, 2rem line-height): page-level titles (track title in the edit header, card titles).
- **Headline** (600, 1.125rem, 1.5rem line-height): section/card titles within a page.
- **Title** (600, 1rem, 1.5rem line-height): sub-section labels, dialog titles.
- **Body** (400, 0.875rem, 1.4rem line-height): all instructional and conversational copy; capped informally around 65–75ch by the card/container width, never a full-bleed paragraph.
- **Label** (600, 0.6875rem, 0.08em letter-spacing, uppercase): telemetry labels (KEY / TEMPO / TIME), form field microcopy.
- **Telemetry** (500, 0.875rem, JetBrains Mono, tabular-nums): every live numeric readout.

### Named Rules
**The No-Jitter Rule.** Any number that can change while the user is looking at it — BPM, timecode, duration, dB — is set in JetBrains Mono with tabular-nums. A readout that visually shifts width when the digits change is a bug, not a style choice.

## 4. Elevation

No drop shadows. Depth is conveyed entirely through tonal tiering (canvas → rack → strip → dock, each a lighter step of the same obsidian hue) plus a single 1px hairline ring on anything that floats above the page (dialogs, dropdown menus): `ring-1 ring-foreground/10`. This keeps multi-track/multi-panel screens from turning muddy the way heavy shadows do on a dark surface.

### Named Rules
**The Tonal-Tier-Not-Shadow Rule.** If a component needs to look "raised," it moves one step up the canvas → rack → strip → dock ladder and gets the hairline ring. It does not get a `box-shadow`. The one exception is the brass/teal/cyan "signal glow" on active transport controls and live indicators, which is a deliberate saturated accent, not a neutral elevation shadow.

## 5. Components

Buttons, cards, and inputs read as **machined hardware**: small, tight corner radii (never the soft, pillowy rounding of a consumer app), flat fills, and tactile hover/active states. Pills are the one deliberate exception, reserved for things that are switched, not pressed.

### Buttons
- **Shape:** 4px corners (`{rounded.hardware}`) — CNC-machined-plate feel, not a soft consumer rounding.
- **Primary:** Orchestral Brass fill, on-brass ink text (#241a04) for contrast, 8px/16px padding.
- **Hover / Focus:** primary hover lightens to Brass Hover; focus ring is Orchestral Brass at full opacity, no blur/glow halo.
- **Outline / Ghost / Secondary:** transparent or Surface Strip fill, hairline border, ink text — used for every non-primary action so the primary brass button stays singular per view.
- **Destructive:** Ruby Alert text/border on an outline button; never a solid ruby fill except inside a confirmation-critical control.

### Tabs (Edit page navigation)
- **Style:** full-pill (`{rounded.pill}`) segmented buttons, not underline tabs — the one place pills are correct, since these are literally mode switches (Trim / Metronome / Split).
- **Active:** Orchestral Brass at 15% background tint, brass text, brass/40% border.
- **Inactive:** muted slate text, hairline border, no fill.

### Cards / Containers
- **Corner Style:** 8px (`{rounded.panel}`).
- **Background:** Surface Rack, one step off canvas.
- **Shadow Strategy:** none — see Elevation. Depth comes from the tonal step alone.
- **Border:** hairline only.
- **Internal Padding:** 16px (`{spacing.lg}`) default card padding; 24px on top-level page containers.

### Inputs / Fields
- **Style:** Surface Strip or the dedicated Input surface, hairline border, 4px corners.
- **Focus:** border shifts to Orchestral Brass, no glow/blur — matches the button focus rule.
- **Error:** Ruby Alert border and helper text below the field, never a red glow.

### Telemetry Readout (signature component)
The persistent Key / Tempo / Time strip in the edit header: a small hairline-bordered pill containing a colored status dot (cyan for Key, brass for Tempo, teal for Time) plus a JetBrains Mono value. This is the component that makes the "console" metaphor legible at a glance — it should be reused anywhere a live analyzed value needs to be shown, rather than inventing a new badge style.

### Navigation
- **Site header:** Logo (favicon mark + wordmark) left, user avatar menu right, hairline bottom border, Surface Rack tint background.
- **Edit header:** adds the Telemetry Readout strip and the pill Tabs row beneath the title, all on the same hairline-bordered header block.

### Mascot & Delight States (signature pattern)
Every success toast, error toast, error inline state, and the tip-jar modal pairs its message with the mascot: happy-logo.png (or the animated GIF variant while a job is queued/processing) for success/waiting, sad-logo.png for errors. This is the one place personality is allowed inside a functional UI element — it never appears inside a primary control (buttons, inputs, telemetry).

## 6. Do's and Don'ts

### Do:
- **Do** keep the canvas permanently dark (#0c121e base) — this is a console, not a document; there is no light mode to design for.
- **Do** use Orchestral Brass as the only warm accent, reserved for primary actions and active/focused state.
- **Do** use Phosphor Emerald only for "safe/engaged" signals and Studio Cyan only for "active/in-motion" signals — never interchange them or use either as decoration.
- **Do** set every live numeric readout in JetBrains Mono with tabular-nums.
- **Do** pair every success/error state with the happy or sad mascot — that pairing is the brand's signature delight moment, not optional polish.
- **Do** use 4px hardware-radius corners on buttons/inputs and 8px on cards/panels; reserve full-pill radius for genuine mode-switch controls (tabs).

### Don't:
- **Don't** build a generic SaaS card-grid dashboard — PRODUCT.md names this directly as the anti-reference. No identical stat-card rows, no hero-metric tiles.
- **Don't** add `box-shadow` for elevation. Use the canvas → rack → strip → dock tonal ladder plus a hairline ring instead.
- **Don't** use a side-stripe (`border-left`/`border-right` accent) on any card, list item, or alert.
- **Don't** use gradient text, glassmorphism as a default surface treatment, or a bouncy/elastic easing curve anywhere.
- **Don't** let delight (mascot, playful copy, tip jar) leak into the actual editing controls — waveform, tempo, and fader precision always wins over personality inside the controls themselves.
