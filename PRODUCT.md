# Product

## Register

product

## Users

Music directors and a small closed team (affiliated via `rgmcgroup.com` and similar organizations), signed in through an invite-only, affiliation-gated login. They use this between rehearsals and performances: pulling a reference track off YouTube or uploading their own recording, then trimming a clip, building a click track to check tempo, or splitting stems to isolate a part, before jumping back into whatever they're actually rehearsing or performing.

## Product Purpose

A small audio workflow utility suite that replaces a local Python/tkinter tool (dlp-gui) with a shared, always-on web app. It exists so the team doesn't need a full DAW for quick, everyday tasks: download, trim, tempo-check, and stem-split. Success is a music director going from "I have a YouTube link or a recording" to "I have the exact clip/click-track/stem I need" in a couple of minutes, without training.

## Brand Personality

Playful, creative, entertaining — not a sterile enterprise tool. The team wants a product that feels like it has a personality (mascot reactions on success/error, a rotating-message tip jar, informal copy) layered on top of a genuinely precise, DAW-console-grade instrument (dark obsidian theme, brass/gold + cyan/teal telemetry accents, monospace numeric readouts). The fun lives in the margins — toasts, empty states, celebratory moments — while the actual editing controls (trim handles, BPM readout, stem faders) stay clear and professional.

## Anti-references

Explicitly not a generic SaaS admin dashboard: no cookie-cutter card-grid panels, no generic hero-metric tiles, no interchangeable-with-any-B2B-tool look. The DAW/console identity and the mascot-driven personality are what keep this from reading as templated.

## Design Principles

- Show personality without slowing down the workflow — delight belongs in secondary moments (toasts, empty states, success/error mascots, the tip jar), never in the way of the primary task.
- Every screen explains itself — plain-language instructions sit alongside pro-grade controls so a first-time user isn't lost, without dumbing down the tool.
- One consistent instrument, not a dashboard — every tab reads as part of the same console (shared header telemetry, shared tab chrome, shared component language), never a loose collection of generic admin pages.
- Precision where it counts — the actual editing surfaces (waveform, tempo, faders) stay accurate and legible even where the surrounding chrome is playful.

## Accessibility & Inclusion

No formal WCAG target was set by the team; inferred baseline for a small internal tool: keyboard-operable controls, sufficient contrast against the dark theme's surfaces, and respecting `prefers-reduced-motion` for any animated/looping elements (e.g. the mascot GIF). Revisit if the team has specific requirements.
