# PSMA app guide: capture, render, install

The "How to use this app" walkthrough of the Mamba PSMA Streamlit app (`Mamba_PSMA/gui/app.py`):
a portal page at `/portal/psma-app-guide` (module `src/components/portal/modules/psma-app-guide/`)
exported as `Mamba_PSMA/gui/assets/how-to-use.mp4`, the video the app's "How to use this app"
button plays.

## What is real and what is drawn

- **Real:** everything inside the app window is a lossless screenshot of the running app
  (commit `9ad3754`, device scale 2, 3840 x 2160), taken by `capture_app.py`. Each capture's
  file hash, the app's visible text, control positions and state are in
  `motion-data/app-guide/manifest.json`. Scans: autoPET-III only (the tool refuses any
  `deeppsma` path and records only `psma_` case ids).
- **Drawn over it:** camera moves, a cursor whose clicks land on the controls' recorded
  positions, highlight rings and spotlight, callouts, captions, the comparison legend (the app's
  exact colours), the score definitions, the sped-up tag, chapter cards and the chapter strip.
- **In-app motion** (lists opening, typing, sliders, slices, the rotating MIP) is shown with the
  app's own intermediate states and captured frame sequences, never imitated.
- **Model runs are sped up:** each run was filmed live (a screenshot every 2.4-3 s from the click
  to "Finished"); the film places each frame at its real time since the click divided by the
  speed (8x for the first run, 24x for the two later ones) and the tag shows the app's own
  "Finished in N s".
- **Motion blur** (render only): where the camera, a chapter curtain, the cursor or a scroll
  moves, a frame averages 2-8 sub-frame samples across a 180-degree shutter. Never across a
  captured frame-sequence step or a cut: two app states are never blended into one frame.
- **Skipped actions** (setting a slider back, typing a path) happen behind a chapter curtain or
  out of frame, never on a control in view.

## Files

| File | What it does |
|---|---|
| `capture_app.py` | Films the app through `Mamba_PSMA/outputs/gui-capture-tools/cdp.py`. Shot lists `shots_<name>`: `pre`, `pre2`, `pre3` (before N's run), `run` (Run model, live), `post`, `custom`, `nogt`, `yours`, `wrong`. Refuses "Re-run model". |
| `truth_wsl.py` | In WSL (`mamba` env), read only: the app's own `score_prediction` and lesion rows for each filmed run, and where each lesion shows on its coronal slice. Writes `motion-data/app-guide/truth.json`. |
| `thumbs.py` | Finds slider thumbs in captures (the cursor drags by them). |
| `capture.mjs` | Renders the stage frame by frame (puppeteer-core, local Chrome): `probe`, `timeline`, `textboxes`, `shots`, `sheets`, `video [--preview] [--frames a:b --tag pN]`, `join`, `encode`. |
| `mix_frames.py` | The render's frame mixer: averages motion-blur samples, writes the lossless master, records frame differences (gate G5). |
| `gates.py` | Gates G1 (provenance), G2 (truth), G3 (clicks and rings), G4 (reading time, type, contrast), G5 (no one-frame jumps, safe margins). |
| `make_sheets.py` | Contact sheets and transition strips for review. |

## Re-capture

Needs: the app running on its own port with `PSMA_DATA` at the autoPET folder only, e.g.
`MSYS_NO_PATHCONV=1 wsl -d Ubuntu -e bash /mnt/c/Users/james/Documents/university/cits4010/Mamba_PSMA/outputs/gui-capture-tools/gui_server.sh 8502 PSMA_DATA=/mnt/c/Users/james/Documents/university/cits4010/datasets/PSMA-PET-CT-Lesions_v3 PYTHONDONTWRITEBYTECODE=1`,
and Windows Python with Pillow, numpy and websocket-client.

```
python -B tools/psma-app-guide/capture_app.py pre      # N must have no saved run
python -B tools/psma-app-guide/capture_app.py pre2
python -B tools/psma-app-guide/capture_app.py run      # one heavy job: run nvidia-smi first
# in WSL: tools/psma-app-guide/truth_wsl.py --out motion-data/app-guide/truth.json
python -B tools/psma-app-guide/capture_app.py post
python -B tools/psma-app-guide/capture_app.py custom   # a second run
python -B tools/psma-app-guide/capture_app.py nogt     # a third run
python -B tools/psma-app-guide/capture_app.py yours
python -B tools/psma-app-guide/capture_app.py wrong
python -B tools/psma-app-guide/thumbs.py B05:fusion B06a:fusion ...   # see the README history in the review log
```

`pre3` needs N's run folder moved aside and a freshly started server (no run status left
over); see the review log. Each run writes a folder under `Mamba_PSMA/outputs/gui-predictions/`:
`psma_35852148926fc57d_2018-03-23/` (with `custom/p0.3_v5-<hash>/`) and
`single/psma_35852148926fc57d_2018-03-23-<hash>/`. Never press Re-run on a saved run; delete
only folders this tool created.

## Re-render and re-install

```
npm run dev -- --port 5179 --strictPort
node tools/psma-app-guide/capture.mjs timeline   --out motion-data/app-guide/review/<run>
node tools/psma-app-guide/capture.mjs textboxes  --out motion-data/app-guide/review/<run>
node tools/psma-app-guide/capture.mjs video --preview --out motion-data/app-guide/render   # 960 x 540, 15 fps
node tools/psma-app-guide/capture.mjs video --crf <n> --out motion-data/app-guide/render   # 1920 x 1080, 30 fps
python -B tools/psma-app-guide/gates.py g1 ... g5   (see the gate commands at the top of gates.py)
```

The 1080p render can run as parts side by side (two workers suit this 6-core PC) and be joined
losslessly; the join recomputes the frame difference across each boundary from the masters and
refuses a master whose frame count is not the film's:

```
node tools/psma-app-guide/capture.mjs video --frames 0:4007 --tag p1 --out motion-data/app-guide/render
node tools/psma-app-guide/capture.mjs video --frames 4007:8014 --tag p2 --out motion-data/app-guide/render
node tools/psma-app-guide/capture.mjs join --parts p1,p2 --crf <n> --out motion-data/app-guide/render
node tools/psma-app-guide/capture.mjs encode --crf <n> --out motion-data/app-guide/render   # re-encode only
```

(`8014` = duration x 30 + 1, rounded; `probe` prints the duration.)

The final encode is H.264 High, yuv420p, BT.709 tags, `+faststart`, no audio. Copy
`motion-data/app-guide/render/how-to-use.mp4` to `Mamba_PSMA/gui/assets/how-to-use.mp4` only if
no file is there (never overwrite one). The captures and renders show patient scans: they stay
in the gitignored `motion-data/`, are served only by the dev server, and a production build of
the portal shows a "local only" notice instead.
