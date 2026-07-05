# Codex Guidelines for HTGCloud

These are standing implementation rules for this repository.

## Brand Basics

- Use the existing light theme by default. The root background is `#ffffff`, with primary text using `--ink: #11161c`.
- Use the existing HTGCloud logo asset pattern. The site header and footer use `logoPath = "/logo.png"` and render it at `126px` wide in the current CSS.
- Use the existing color tokens from `src/styles.css`:
  - `--brand: #48d4d3`
  - `--brand-dark: #23b8be`
  - `--ink: #11161c`
  - `--muted: #65707c`
  - `--line: #e9eef1`
  - `--panel: #f6f8f8`
  - `--soft-cyan: #e3fbfa`
  - `--mint: #d7fff0`
- Use the existing font stack from `src/styles.css`: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Match existing button styles instead of inventing new ones:
  - Primary dark buttons use `background: #11161b`, white text, `border-radius: 8px`, and a subtle shadow.
  - Primary dark hover state uses `background: #263039`.
  - Secondary buttons should follow the existing light/outline style with subtle border and brand-accent hover treatment.

## Code Safety Rules

- Never modify `server/index.js` unless a prompt explicitly says to.
- Never modify `prisma/schema.prisma` unless a prompt explicitly says to.
- Never remove or rename existing routes.
- Keep changes scoped to the requested page, section, or workflow.

## Validation Rules

- Always run a build check before reporting a task done:

```bash
npm run build
```

- On this Windows environment, `npm.cmd run build` may be needed if PowerShell blocks `npm.ps1`.

## Reference Matching Rules

- When asked to match an external reference, competitor site, screenshot, or Figma file, match layout, spacing, typography, component structure, and information architecture.
- Do not copy the reference site's literal color scheme.
- Use HTGCloud's own brand colors and light-theme visual language unless the prompt explicitly says otherwise.
