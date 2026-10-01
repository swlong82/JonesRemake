# Realistic art pipeline (runs on your machine)

Makes a realistic, painted-looking art bundle from the game's own slot layouts. Everything runs locally: no API keys, no uploads. The only network use is the one-time download of the models from Hugging Face.

```
SVG slot ──render──▶ guide PNG ──edges──▶ SDXL + Canny ControlNet ──▶ candidates ──you pick──▶ cut-out + WebP ──▶ bundle
(default set)       (Node, resvg)                (generate.py)                          (promote.py)      art/bundles/realistic/
```

The existing SVG supplies the layout, camera and silhouette, so the picture stays in the right place and size; the model only changes how it looks. Object slots (buildings, characters) are cut out with the SVG's own silhouette, so no background-removal model is needed.

## What you need

- Apple Silicon Mac (this guide), 16 GB RAM or more recommended, and about 15 GB of free disk for the models and candidates.
- Homebrew, Python 3.10+, Node 22+ and pnpm. If missing: `brew install python@3.11 node pnpm`.
- This repository checked out on the `art/realistic-pipeline` branch (or `main` once merged).

## Run the pilot (7 slots)

From the repository root:

```bash
pnpm install
art/gen/run.sh setup       # once; installs the Python packages into art/gen/.venv
art/gen/run.sh doctor      # should end with "doctor — OK"
art/gen/run.sh pilot 4     # renders guides, then makes 4 candidates for each of the 7 slots
```

The first generation downloads the models (several GB) and is slow. After that, expect roughly a minute or more per image on Apple Silicon, so the pilot (28 images) takes a while; start with `pilot 2`. These times are rough: measure your own and tell me.

Then look at `art/gen/work/contact.html` (guide on the left, candidates beside it) and pick the best seed for each slot:

```bash
cd art/gen
.venv/bin/python promote.py pick building.bank=2 building.grocery=1 building.clothing-boutique=3 \
  interior.clothing-boutique=2 avatar.player-1.idle.s=1 avatar.player-1.walk1.e=1 avatar.player-1.walk2.e=1
cd ../..
art/gen/run.sh build       # WebP + bundle.json + provenance.json + budgets check + contact sheet
```

The bundle lands in `art/bundles/realistic/`. Send me that folder (or `python promote.py zip`), or commit it on a branch and push.

## Judging the pilot

The pilot passes if (1) the art director rates it clearly better than today's art side by side, (2) every file is within its byte budget (`promote.py check` says so), (3) the slice regenerates in style from `provenance.json` (same seeds and settings), and (4) it plays in the real scene on desktop and phone. Item 4 needs the game to load the bundle, which is the next step after this one.

## Tuning

| Want                               | Do                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Follow the SVG layout more closely | `generate.py run --control 0.9` (default 0.75)                                                                 |
| More creative rendering            | `--control 0.55`                                                                                               |
| Black or noisy images              | `--dtype float32` (needs more memory)                                                                          |
| More candidates                    | `--seeds 8`                                                                                                    |
| Different look                     | edit `style.json` (preamble, negative prompt) and `subjects.json` (what each slot shows), then rerun `--force` |
| Soften or tighten the cut-out      | `promote.py build --grow 10 --feather 3`                                                                       |

## Files

| File                          | Purpose                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `style.json`, `subjects.json` | The look and what each slot shows. Edit these, not the scripts              |
| `generate.py`                 | Makes candidates (SDXL + Canny ControlNet) with full provenance per image   |
| `promote.py`                  | Contact sheets, picking, cut-out, WebP, budgets, bundle and provenance, zip |
| `test_pipeline.py`            | Model-free tests: `cd art/gen && python3 -m unittest test_pipeline`         |
| `work/`                       | Guides and candidates. Git-ignored                                          |
| `../bundles/realistic/`       | The output bundle: `files/*.webp`, `bundle.json`, `provenance.json`         |

## Licences and provenance

Check the licence of every model before shipping its output: the links are printed by `generate.py doctor`. Every shipped file has its model ids, settings, seed, prompt and guide hash in `provenance.json`. After you approve files, add rows to `art/ASSET_LOG.md` (route C, tool "SDXL + Canny ControlNet, local") and have a human review each picture.

## What is not done yet

The generation step has not been run against real models by me: this session has no GPU and cannot download them. The guide rendering, edge maps, cut-out, WebP encoding, budgets and bundle are tested (`test_pipeline.py`). Wiring the bundle into the game's art registry (raster slots, a raster budget, the player-colour ring under characters) is a separate change.
