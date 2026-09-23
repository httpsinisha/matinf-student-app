# Onboarding verification

The introductory screen was compared with `design/onboarding-design.png` using Android emulator screenshots at 1080 × 2400 (420 dpi). The reference phone display is approximately 687 × 1502, excluding its frame.

Open `compare.html` for the reference, final screenshot, and an adjustable overlay. The image comparison preserves screen width; native status/navigation bars and the slightly taller emulator remain different. This is a close visual match, not a claim of identical pixels.

Visual iterations adjusted the top spacing, headline size, and footer position. `intro-final.png` is the final capture. Other captures show program selection, selected years/courses, notification setup, and completion.

## Implemented flow

1. Native introductory screen, optional-setup explanation, Continue and Skip.
2. Demo program/year and individual-course selections. Selecting a year includes its courses; choices from different programs remain independent. Back navigation retains the draft.
3. Explicit notification opt-in or “Ne sada”, local persistence, and a completion screen with controls to edit preferences or revisit the introduction.

Saved preferences use `@matinf/onboarding/v1` in AsyncStorage. Launches after completion show the completion screen. Skip on the introduction clears academic selections and saves an opt-out. “Ne sada” retains selections without enabling notifications.

## Checks completed

- `npx tsc --noEmit`
- `node --test scripts/onboarding-model.test.mjs` (3 tests)
- Emulator: Continue, program-year selection, individual-course selection, inherited course selection, Android Back, retained draft, opt-in in Expo Go, Skip, and persistence across force-stop/relaunch.

The archived `example/` starter and nested `matinf/` scaffold are excluded from the active app's TypeScript check because the archived starter imports components that were moved out of `src/`.

## Integration boundaries

- Only the first screen has a supplied reference. The other steps use its colors, typography, and rounded controls.
- Artwork and logo use clipped regions of an unchanged copy of the supplied raster. All interface text and controls are native. Standalone art can replace the source later.
- The academic catalog is explicitly demo data (`src/data/study-catalog.ts`), not an official curriculum. Doctoral duration is a demo default of three years.
- WordPress catalog fetching, push-token registration, subscription synchronization, and the content home screen are separate integration work. No successful subscription or notification delivery is claimed; opt-in remains pending.
- Expo Go and web record permission as unavailable. A native development/release build requests permission via Expo Notifications after creating the Android channel. Remote notification delivery still requires Expo/Firebase and backend integration.

## Standalone native verification — 23 September 2026

The release-mode x86_64 preview installed and cold-launched on API 36 with Metro port forwarding removed. `native-intro.png` matches the earlier layout; the different screen aspect ratio and system bars still prevent an identical-pixel claim against the reference.

`native-permission-dialog.png` shows Android's actual MATINF permission prompt. `native-denied.png` and `native-granted.png` show both outcomes. The selected first study year and denied status survived force-stop/relaunch. Later approval worked through the app's edit flow; the completion message correctly keeps remote subscription pending. Metro forwarding was restored after the test.

Expo SDK 57 references used: [SDK overview](https://docs.expo.dev/versions/v57.0.0/), [StatusBar](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/), [safe areas](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/), [notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
