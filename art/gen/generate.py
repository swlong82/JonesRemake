#!/usr/bin/env python3
"""Generate realistic candidate images for art slots (step 2 of the realistic art pipeline).

    python generate.py doctor                   # check this machine, no downloads
    python generate.py run --pilot --seeds 4    # make 4 candidates for each pilot slot
    python generate.py run --only building.bank --seeds 8 --force

Reads work/jobs.json (made by `pnpm art:gen:guides`). For every job and seed it runs Stable
Diffusion XL with a Canny ControlNet whose edge map comes from the slot's existing SVG, so the
layout, camera and silhouette stay as in the game while the model only changes the rendering.
Everything runs on this machine: no keys, no uploads. The first run downloads the models from
Hugging Face (several GB); after that it works offline.

Outputs, per slot: work/out/<slug>/seed<N>.png and seed<N>.json (the full provenance: model ids,
settings, prompt, guide hash, library versions). Nothing here touches the repo's art sets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
STYLE = json.loads((HERE / "style.json").read_text())

BASE_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
CONTROLNET = "diffusers/controlnet-canny-sdxl-1.0"
VAE = "madebyollin/sdxl-vae-fp16-fix"


def load_jobs(args: argparse.Namespace) -> list[dict]:
    path = WORK / "jobs.json"
    if not path.exists():
        sys.exit("work/jobs.json is missing. From the repo root run:  pnpm art:gen:guides --pilot")
    jobs = json.loads(path.read_text())["jobs"]
    if args.only:
        wanted = set(args.only)
        jobs = [j for j in jobs if j["slug"] in wanted or j["key"] in wanted]
    if args.limit:
        jobs = jobs[: args.limit]
    if not jobs:
        sys.exit("no jobs match")
    return jobs


def edge_map(guide: Path, size: tuple[int, int]):
    """White edges on black from the guide PNG, the way the canny ControlNet expects."""
    import numpy as np
    from PIL import Image

    img = Image.open(guide).convert("RGBA")
    flat = Image.new("RGBA", img.size, (255, 255, 255, 255))
    flat.alpha_composite(img)
    gray = np.array(flat.convert("L"))
    try:
        import cv2

        edges = cv2.Canny(gray, 80, 180)
        edges = cv2.dilate(edges, np.ones((2, 2), np.uint8))
    except ImportError:  # slower, rougher fallback with Pillow only
        from PIL import ImageFilter

        e = flat.convert("L").filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 24 else 0)
        edges = np.array(e.filter(ImageFilter.MaxFilter(3)))
    out = Image.fromarray(edges).convert("RGB")
    return out if out.size == size else out.resize(size, Image.NEAREST)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pick_device(torch) -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def cmd_doctor(_: argparse.Namespace) -> int:
    ok = True
    print(f"python {platform.python_version()} on {platform.platform()}")
    if sys.version_info < (3, 10):
        print("✗ need Python 3.10 or newer"); ok = False
    for mod in ("torch", "diffusers", "transformers", "PIL", "numpy"):
        try:
            m = __import__(mod)
            print(f"✓ {mod} {getattr(m, '__version__', '')}")
        except ImportError:
            print(f"✗ {mod} is not installed (pip install -r requirements.txt)"); ok = False
    try:
        import torch

        dev = pick_device(torch)
        print(f"✓ compute device: {dev}" + ("" if dev != "cpu" else "  (CPU only: expect many minutes per image)"))
    except ImportError:
        pass
    free = shutil.disk_usage(HERE).free / 1e9
    print(f"{'✓' if free > 20 else '✗'} free disk: {free:.0f} GB (first run needs roughly 15 GB for models and candidates)")
    ok = ok and free > 20
    print(f"{'✓' if (WORK / 'jobs.json').exists() else '✗'} work/jobs.json" + ("" if (WORK / 'jobs.json').exists() else "  (run: pnpm art:gen:guides --pilot)"))
    ok = ok and (WORK / "jobs.json").exists()
    print("Reminder: check the licences of the models below before shipping their output:")
    for m in (BASE_MODEL, CONTROLNET, VAE):
        print(f"  - https://huggingface.co/{m}")
    print("doctor — " + ("OK" if ok else "FIX THE ITEMS ABOVE"))
    return 0 if ok else 1


def cmd_run(args: argparse.Namespace) -> int:
    jobs = load_jobs(args)
    seeds = list(range(1, args.seeds + 1))
    todo = []
    for j in jobs:
        for s in seeds:
            out = WORK / "out" / j["slug"] / f"seed{s}.png"
            if out.exists() and not args.force:
                continue
            todo.append((j, s, out))
    print(f"{len(jobs)} slot(s) × {len(seeds)} seed(s): {len(todo)} image(s) to make")
    if args.dry_run:
        for j, s, out in todo:
            print(f"  would make {out.relative_to(HERE)}  ({j['genWidth']}×{j['genHeight']})")
        return 0
    if not todo:
        print("nothing to do (use --force to remake)")
        return 0

    import numpy as np
    import torch
    import diffusers
    from diffusers import AutoencoderKL, ControlNetModel, StableDiffusionXLControlNetPipeline

    device = pick_device(torch)
    dtype = torch.float32 if (args.dtype == "float32" or device == "cpu") else torch.float16
    print(f"device {device}, dtype {str(dtype).split('.')[-1]}; loading models (first run downloads them)…")
    controlnet = ControlNetModel.from_pretrained(args.controlnet, torch_dtype=dtype)
    vae = AutoencoderKL.from_pretrained(VAE, torch_dtype=dtype)
    kwargs = {"variant": "fp16"} if dtype == torch.float16 else {}
    pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
        args.base, controlnet=controlnet, vae=vae, torch_dtype=dtype, use_safetensors=True, **kwargs
    ).to(device)
    pipe.enable_attention_slicing()  # keeps memory down on 16 GB Macs
    pipe.set_progress_bar_config(disable=True)

    made = 0
    for n, (j, seed, out) in enumerate(todo, 1):
        guide = WORK / j["guide"]
        size = (j["genWidth"], j["genHeight"])
        edges = edge_map(guide, size)
        t0 = time.time()
        # A CPU generator keeps seeds reproducible across devices.
        gen = torch.Generator("cpu").manual_seed(seed)
        image = pipe(
            prompt=j["prompt"],
            negative_prompt=j["negative"],
            image=edges,
            controlnet_conditioning_scale=args.control or STYLE["controlnetScale"],
            num_inference_steps=args.steps or STYLE["steps"],
            guidance_scale=STYLE["guidance"],
            width=size[0],
            height=size[1],
            generator=gen,
        ).images[0]
        secs = time.time() - t0
        if np.array(image).max() < 8:
            print(f"  ! {j['slug']} seed{seed} came out black. Retry with --dtype float32")
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        image.save(out)
        meta = {
            "key": j["key"],
            "slug": j["slug"],
            "seed": seed,
            "prompt": j["prompt"],
            "negative": j["negative"],
            "steps": args.steps or STYLE["steps"],
            "guidance": STYLE["guidance"],
            "controlnetScale": args.control or STYLE["controlnetScale"],
            "baseModel": args.base,
            "controlnet": args.controlnet,
            "vae": VAE,
            "guideSha256": sha256(guide),
            "styleVersion": STYLE["version"],
            "device": device,
            "dtype": str(dtype).split(".")[-1],
            "torch": torch.__version__,
            "diffusers": diffusers.__version__,
            "seconds": round(secs, 1),
            "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        out.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n")
        made += 1
        print(f"  [{n}/{len(todo)}] {j['slug']} seed{seed}  {secs:.0f}s")
    print(f"made {made} image(s). Next:  python promote.py contact")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor", help="check this machine; downloads nothing").set_defaults(fn=cmd_doctor)
    r = sub.add_parser("run", help="make candidate images")
    r.add_argument("--seeds", type=int, default=4, help="candidates per slot (default 4)")
    r.add_argument("--only", nargs="*", help="slot keys or slugs, e.g. building.bank")
    r.add_argument("--pilot", action="store_true", help="accepted for clarity; jobs.json already holds the pilot")
    r.add_argument("--limit", type=int, help="first N slots only")
    r.add_argument("--steps", type=int)
    r.add_argument("--control", type=float, help="ControlNet strength (higher follows the SVG more)")
    r.add_argument("--dtype", choices=["float16", "float32"], default="float16")
    r.add_argument("--base", default=BASE_MODEL)
    r.add_argument("--controlnet", default=CONTROLNET)
    r.add_argument("--force", action="store_true")
    r.add_argument("--dry-run", action="store_true")
    r.set_defaults(fn=cmd_run)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
