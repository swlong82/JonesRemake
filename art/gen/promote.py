#!/usr/bin/env python3
"""Pick candidates and build the realistic art bundle (step 3 of the realistic art pipeline).

    python promote.py contact                       # contact sheet of every candidate (work/contact.html)
    python promote.py pick building.bank=2 interior.clothing-boutique=1
    python promote.py build                         # cut out, resize, WebP, bundle.json, provenance
    python promote.py check                         # validate the built bundle against the budgets
    python promote.py sheet                         # contact sheet of the built bundle
    python promote.py zip                           # realistic-bundle.zip to move or commit

No models and no network are needed here: it only uses Pillow. The bundle is written to
art/bundles/realistic/ and is a plain folder of WebP files, a bundle.json and a provenance.json.
Wiring the bundle into the game's art registry is a separate, later step (GRAPHICS_PLAN).
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import sys
import time
import zipfile
from pathlib import Path

from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
BUNDLE = HERE.parent / "bundles" / "realistic"

# Per-file byte budgets and the whole-bundle budget (GRAPHICS_PLAN: about 8 MB, lazy per scene).
FILE_BUDGET = {"building": 80_000, "avatar": 40_000, "host": 80_000, "interior": 150_000}
BUNDLE_BUDGET = 8_000_000
QUALITIES = (84, 80, 76, 72, 68, 64, 60)


def load_jobs() -> dict[str, dict]:
    path = WORK / "jobs.json"
    if not path.exists():
        sys.exit("work/jobs.json is missing (pnpm art:gen:guides --pilot)")
    return {j["slug"]: j for j in json.loads(path.read_text())["jobs"]}


def candidates(slug: str) -> list[Path]:
    return sorted((WORK / "out" / slug).glob("seed*.png"), key=lambda p: int(p.stem[4:]))


def cmd_contact(_: argparse.Namespace) -> int:
    jobs = load_jobs()
    rows = []
    for slug, job in jobs.items():
        cells = [f'<figure><img src="{html.escape(job["guide"])}"><figcaption>guide</figcaption></figure>']
        for c in candidates(slug):
            rel = c.relative_to(WORK).as_posix()
            cells.append(f'<figure><img src="{html.escape(rel)}"><figcaption>seed {c.stem[4:]}</figcaption></figure>')
        rows.append(f'<h2>{html.escape(job["key"])}</h2><div class="row">{"".join(cells)}</div>')
    (WORK / "contact.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Candidates</title><style>"
        "body{font:14px system-ui;margin:16px;background:#ece6da}.row{display:flex;gap:8px;flex-wrap:wrap}"
        "figure{margin:0}img{height:260px;background:#ccc}figcaption{font-size:12px}"
        "</style>" + "".join(rows)
    )
    print(f"work/contact.html written ({sum(len(candidates(s)) for s in jobs)} candidate image(s))")
    return 0


def cmd_pick(args: argparse.Namespace) -> int:
    jobs = load_jobs()
    path = WORK / "approved.json"
    approved = json.loads(path.read_text()) if path.exists() else {}
    for item in args.picks:
        slug, _, seed = item.partition("=")
        if slug not in jobs or not seed.isdigit():
            sys.exit(f"bad pick '{item}': use slug=seed, e.g. building.bank=2")
        if not (WORK / "out" / slug / f"seed{seed}.png").exists():
            sys.exit(f"no candidate {slug} seed{seed}")
        approved[slug] = int(seed)
    path.write_text(json.dumps(approved, indent=2) + "\n")
    print(f"{len(approved)} slot(s) approved: {', '.join(f'{k}={v}' for k, v in approved.items())}")
    return 0


def cutout(image: Image.Image, guide: Image.Image, grow: int, feather: float) -> Image.Image:
    """Use the SVG's own silhouette as the mask: deterministic, no background-removal model."""
    alpha = guide.convert("RGBA").getchannel("A").resize(image.size, Image.LANCZOS)
    if grow > 0:
        alpha = alpha.filter(ImageFilter.MaxFilter(grow * 2 + 1))
    if feather > 0:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    out = image.convert("RGBA")
    out.putalpha(alpha)
    return out


def encode(image: Image.Image, dest: Path, budget: int) -> tuple[int, int]:
    """Smallest quality step that fits the budget; returns (bytes, quality)."""
    for q in QUALITIES:
        image.save(dest, "WEBP", quality=q, method=6, alpha_quality=90)
        size = dest.stat().st_size
        if size <= budget:
            return size, q
    return dest.stat().st_size, QUALITIES[-1]


def cmd_build(args: argparse.Namespace) -> int:
    jobs = load_jobs()
    path = WORK / "approved.json"
    if not path.exists():
        sys.exit("nothing approved yet (python promote.py pick slug=seed …)")
    approved: dict[str, int] = json.loads(path.read_text())
    (BUNDLE / "files").mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}
    prov: dict[str, dict] = {}
    problems = 0
    for slug, seed in approved.items():
        job = jobs[slug]
        src = WORK / "out" / slug / f"seed{seed}.png"
        meta_path = src.with_suffix(".json")
        image = Image.open(src).convert("RGB")
        if job["alpha"]:
            image = cutout(image, Image.open(WORK / job["guide"]), args.grow, args.feather)
        image = image.resize((job["outWidth"], job["outHeight"]), Image.LANCZOS)
        dest = BUNDLE / "files" / f"{slug}.webp"
        size, quality = encode(image, dest, FILE_BUDGET[job["kind"]])
        over = size > FILE_BUDGET[job["kind"]]
        problems += over
        assets[job["key"]] = {
            "file": f"{slug}.webp",
            "logicalWidth": job["logicalWidth"],
            "logicalHeight": job["logicalHeight"],
            "pixelWidth": job["outWidth"],
            "pixelHeight": job["outHeight"],
            "alpha": job["alpha"],
            "bytes": size,
            "quality": quality,
        }
        meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
        prov[job["key"]] = {
            **meta,
            "approvedSeed": seed,
            "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
            "builtAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        print(f"{'✗' if over else '✓'} {job['key']}: {size/1000:.1f} kB (q{quality}){'  OVER BUDGET' if over else ''}")
    total = sum(a["bytes"] for a in assets.values())
    bundle = {
        "schemaVersion": 1,
        "id": "realistic",
        "extends": "default",
        "format": "webp",
        "budget": {"fileBytes": FILE_BUDGET, "bundleBytes": BUNDLE_BUDGET},
        "totalBytes": total,
        "assets": dict(sorted(assets.items())),
    }
    (BUNDLE / "bundle.json").write_text(json.dumps(bundle, indent=2) + "\n")
    (BUNDLE / "provenance.json").write_text(json.dumps(dict(sorted(prov.items())), indent=2) + "\n")
    print(f"bundle: {len(assets)} asset(s), {total/1e6:.2f} MB of {BUNDLE_BUDGET/1e6:.0f} MB → {BUNDLE}")
    return 1 if problems else 0


def cmd_check(_: argparse.Namespace) -> int:
    bpath = BUNDLE / "bundle.json"
    if not bpath.exists():
        sys.exit("no bundle yet (python promote.py build)")
    bundle = json.loads(bpath.read_text())
    failed = 0
    total = 0
    for key, a in bundle["assets"].items():
        f = BUNDLE / "files" / a["file"]
        kind = key.split(":")[0]
        if not f.exists():
            print(f"✗ {key}: file missing"); failed += 1; continue
        with Image.open(f) as im:
            problems = []
            if im.format != "WEBP": problems.append(f"format {im.format}")
            if im.size != (a["pixelWidth"], a["pixelHeight"]): problems.append(f"size {im.size}")
            if a["alpha"] and "A" not in im.getbands(): problems.append("no alpha channel")
            if a["alpha"]:
                lo, hi = im.getchannel("A").getextrema()
                if lo > 10: problems.append("alpha is fully opaque (cut-out failed)")
        size = f.stat().st_size
        total += size
        if size > FILE_BUDGET[kind]: problems.append(f"{size} B over the {FILE_BUDGET[kind]} B budget")
        if problems:
            failed += 1
            print(f"✗ {key}: {'; '.join(problems)}")
    if total > BUNDLE_BUDGET:
        failed += 1
        print(f"✗ bundle is {total} B; budget {BUNDLE_BUDGET} B")
    prov = json.loads((BUNDLE / "provenance.json").read_text()) if (BUNDLE / "provenance.json").exists() else {}
    missing = [k for k in bundle["assets"] if k not in prov]
    if missing:
        failed += 1
        print(f"✗ no provenance for: {', '.join(missing)}")
    print(f"check — {len(bundle['assets'])} asset(s), {total/1e6:.2f} MB → {'OK' if not failed else 'FAIL'}")
    return 1 if failed else 0


def cmd_sheet(_: argparse.Namespace) -> int:
    bundle = json.loads((BUNDLE / "bundle.json").read_text())
    cards = "".join(
        f'<figure><div class="f"><img src="files/{html.escape(a["file"])}"></div>'
        f'<figcaption><code>{html.escape(k)}</code> {a["bytes"]/1000:.0f} kB</figcaption></figure>'
        for k, a in bundle["assets"].items()
    )
    (BUNDLE / "contact.html").write_text(
        "<!doctype html><meta charset=utf-8><title>Realistic bundle</title><style>"
        "body{font:14px system-ui;margin:16px;background:#f6f1e7}.g{display:flex;gap:10px;flex-wrap:wrap}"
        "figure{margin:0;background:#fff;border:1px solid #d8c9ad;border-radius:8px;padding:6px}"
        ".f{background:repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px}img{height:240px;display:block}"
        f"</style><h1>Realistic bundle: {len(bundle['assets'])} asset(s), {bundle['totalBytes']/1e6:.2f} MB</h1><div class=g>{cards}</div>"
    )
    print("art/bundles/realistic/contact.html written")
    return 0


def cmd_zip(_: argparse.Namespace) -> int:
    out = BUNDLE.parent / "realistic-bundle.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(BUNDLE.rglob("*")):
            if f.is_file():
                z.write(f, f.relative_to(BUNDLE.parent))
    print(f"{out} ({out.stat().st_size/1e6:.2f} MB)")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("contact").set_defaults(fn=cmd_contact)
    pk = sub.add_parser("pick")
    pk.add_argument("picks", nargs="+", help="slug=seed, e.g. building.bank=2")
    pk.set_defaults(fn=cmd_pick)
    b = sub.add_parser("build")
    b.add_argument("--grow", type=int, default=6, help="pixels the SVG silhouette is grown before cutting out")
    b.add_argument("--feather", type=float, default=2.0, help="edge softness in pixels")
    b.set_defaults(fn=cmd_build)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("sheet").set_defaults(fn=cmd_sheet)
    sub.add_parser("zip").set_defaults(fn=cmd_zip)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
