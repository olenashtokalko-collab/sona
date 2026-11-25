# Prototype V3

`index.html` is `sona-plugin.html` from `sona-prototype.zip` (the branded version, last commit c911321), plus the V1/V2/V3 switch in the top bar.
Everything is in that one file; `brand/` holds the Inter Display fonts and the SONA logo.

- Local: http://localhost:5178
- `#nomic` uses a simulated voice instead of the microphone.
- `#t=review&w=520` jumps to a state (list near the end of the script).
- Prototype states (offline, failed generation, mic denied, signed out) are the toggles at the bottom of the page.

Earlier rounds (v1–v5), the reference PNGs, `workflow.html` and `tools/` stay in the zip.

## Added here
- **help** and **settings** links in the plugin header (as in V1/V2), always visible. Help explains the current step; with no line selected it starts with "Select a line on your timeline".
- Settings: microphone choice (visual only), "Count in 3, 2, 1" (off = recording starts at once), studio account with Sign out / Sign in (same as the "Signed out" prototype state).
