# Model picker scroll clipping — reproduction evidence

Date: 2026-10-13. This evidence accompanies a focused layout fix for `dsh-codex-subscription`.

## Environment and versions

- Installed acceptance: Linux x86_64; npm-installed DSH Web `0.2.0-rc.2`; plugin `2.6.5`; Chromium 140.
- Source baseline: upstream `main` commit `5c326ff497a86f9327edb12317d18a5239aa3154`, package version `3.0.0-beta.4`.
- Latest stable npm version `2.6.6`: the published client has the same relevant faulty CSS. See [release CSS comparison](<latest-release-css.txt>). This is static artifact inspection, **not** a complete installed 2.6.6 acceptance run.

## Screenshots

### Original user report

The user could see the selected model but could not scroll far enough to reveal/click the following model. No account identifiers or authorization material appear in this crop.

![Original reported clipping](<original-report.webp>)

### Independent installed-page reproduction, scrolled to the end

The currently loaded catalog has additional entries compared with the original report. In this reproduction the final entry, `GPT-Reserve (Experimental)`, is clipped below the menu. The exact hidden model depends on catalog length; the defect is not model-specific.

![Installed page before the fix](<installed-before.png>)

### Installed page after the fix, dark mode, 2× device pixel ratio

Both `GPT-6.1-Sol` and the last entry fit inside the menu. Changing the emulated color scheme did not change the user's stored theme preference.

![Installed page after the fix](<installed-after.png>)

## Initial installed-page failure

The initial real-wheel test failed with:

```text
AssertionError: last row is clipped: 454 > menu bottom 421
```

At 1280×720 CSS px:

| Measurement | Before | After |
| --- | ---: | ---: |
| Menu bottom | 421 | 421 |
| List clientHeight | 352 | 314 |
| List scrollTop / maximum | 318 / 318 | 356 / 356 |
| Last row bottom | 454 | 416 |
| Last row center receives pointer input | false | true |
| Outer menu scrollTop | 0 | 0 |
| Search height | 32 | 32 |

The parent's 360px border-box budget must cover 10px padding/border and 36px search/margin. That leaves 314px, not the independently configured 352px. The 38px difference appears in the scroll range and last-row position as well.

## Full logs and replay

- [Complete repository check output (750 lines)](<upstream-check.log>): `pnpm run check`; 699 tests, 673 pass, 26 pre-existing skips, 0 failures; build and pack succeed. Private checkout path replaced with `<checkout>`; no test lines omitted.
- [Installed-browser run](<installed-browser.log>) and [repeat run](<installed-browser-repeat.log>): real DSH service, actual catalog, three viewport sizes, wheel in both directions, search filtering, complete last-row bounds, hit testing, actual model selection and restoration. No model inference request was sent. The script restored `GPT-6-Astra / Xhigh` after every selection run.
- [Standalone Chromium geometry log](<browser-layout.log>): upstream baseline CSS versus candidate CSS; three overflowing scenarios reproduce clipping in the baseline; all four candidate scenarios fit and accept a raw mouse click on the last row.
- [Portable geometry reproduction script](<browser-repro.mjs>): uses the actual exported stylesheet, a minimal menu-shaped DOM, synthetic provider/model labels, and a real Chromium layout engine. Requires Playwright and Chromium. Run against the candidate source checkout:

```sh
# In an environment with playwright-core and its Chromium available:
node browser-repro.mjs <plugin-source-checkout>
# PLAYWRIGHT_MODULE can point to an existing playwright-core module URL.
```

The baseline commit must be available in the checkout. No server, account credentials, or live preference mutations are needed for this standalone test. It uses raw mouse wheel/click rather than locator auto-scroll, since Playwright's `scrollIntoView` can scroll an `overflow:hidden` ancestor and mask the defect.

## Verification boundaries

- The Node tests added in the PR are source/layout-contract tests; Node does not implement CSS layout. Browser geometry and installed-product acceptance are separate evidence channels above.
- Installed acceptance used plugin 2.6.5 with the equivalent local layout patch. Candidate-main acceptance here covers its source contracts, full build/pack/check, and exported CSS in real Chromium. **A complete replacement of the running plugin with main/3.0.0-beta.4 was not performed.**
- The installed page uses the host's actual plugin, real catalog, and existing service. The standalone fixture uses synthetic labels and a fixed, unobstructed menu anchor; it deliberately does not claim to verify DSH shell stacking/positioning.
- Checked installed viewport sizes: 1280×720, 1024×640, 1280×600. Model-selection mouse clicks and neighboring-pane checks run at 1280×720. The small viewports exercise bottom-row geometry and keyboard search. Dark mode/2× DPR was checked separately. Mobile/Safari and all zoom combinations remain unverified.
- A distinct pre-existing short-window issue remains: at 600px-high empty-session viewports, the DSH header can intercept the search input; at 500px the menu top can be off-screen. Same-task baseline/candidate comparison gives the same search position and header hit. This PR does not change menu positioning or z-index and does not claim to fix that issue.
- Asynchronous catalog refresh can insert/remove a 40px loading row above search. A diagnostic test initially mistook that normal reflow for wheel movement. The final installed test asserts outer scrollTop stays zero and search keeps its size/in-menu position instead of requiring identical absolute y across asynchronous states. The last-row full-bounds and actual pointer-selection checks were retained.
- No credentials, OAuth URLs, cookies, account IDs, raw account responses, conversation transcripts, or private machine paths are included. These logs are test output and menu geometry, not a raw server/account dump.
