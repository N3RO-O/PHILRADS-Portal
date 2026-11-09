# PRISM by PHILRADS field guide

The main example follows Tala from sign-in to finishing a relief distribution task with a photo. The phone screens are real screenshots of PRISM 1.9.7, captured from the local dev server with its built-in sample data (`capture.mjs`). People, places, accounts and figures in that sample data are fictional. Sign-in screens are captured in live mode with every Supabase request answered locally, so no real data is read or written.

Both full versions run 5:00 at 30 fps. The phone-first cut is 1080 × 1920. The briefing cut is 1920 × 1080 and places the phone beside the captions. Sharing clips are 720 × 1280. All versions include English narration and open captions.

| Chapter | Main start | Sharing clip |
|---|---:|---:|
| Opening | 0:00 | 0:20 |
| Install and sign in | 0:10 | 0:37 |
| Welcome and Home | 0:44 | 0:25 |
| Notifications | 1:06 | 0:21 |
| Staff Tasks | 1:22 | 0:39 |
| Live Map | 2:11 | 0:28 |
| Inventory Management | 2:36 | 0:23 |
| Response | 2:56 | 0:21 |
| Documentation | 3:14 | 0:24 |
| Forms | 3:34 | 0:23 |
| Projects, Resources and Statistics | 3:54 | 0:28 |
| PDM | 4:19 | 0:20 |
| Profile and settings | 4:25 | 0:21 |
| Coordinators and admins | Separate clip | 0:23 |
| Field tips and closing | 4:41 | 0:23 |

The artwork uses maroon, amber, cream and slate with Archivo Black and Montserrat. The motion is styled like an After Effects infographic: eased push, rise and wipe transitions between screens, a camera push-in toward each tap, numbered callouts on drawn leader lines, kinetic chapter titles and colour sweeps between chapters. The closing explains the name: PRISM is the bridge from the office to the field, one system that splits into response, inventory and staff, so every response can be followed live. The opening uses the repo’s PRISM sign-in theme, which continues quietly under the synthetic English narration.

## Editing

The scenes, narration and screen cues are in `scenes.mjs`; each beat lists which captured screen shows when and which marked element is tapped. To refresh the screens, start the portal dev servers (`npm run dev` on 5173 and the live-mode server on 5175) and run `node capture.mjs <playwright-tools-dir> [shot ids]`. It writes `assets/app/*.jpg` and the tap targets in `assets/app/shots.json`. `stage.mjs` controls the seekable animation and `style.css` defines both layouts. Open the folder in the HyperFrames desktop app or run `npx hyperframes preview` in it. Use `?wide=1` or `?clip=staff-tasks` on the composition page to preview a variant.
