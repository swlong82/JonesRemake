#!/usr/bin/env python3
"""Pick candidates and build the realistic art bundle (step 3 of the realistic art pipeline).

    python promote.py contact                       # contact sheet of every candidate (work/contact.html)
    python promote.py rank                          # score every candidate against its SVG layout
    python promote.py pick --best                   # approve the best-scoring seed of every slot
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

from PIL import Image, ImageEnhance, ImageFilter

HERE = Path(__file__).resolve().parent
WORK = HERE / "work"
BUNDLE = HERE.parent / "bundles" / "realistic"

# Per-file byte budgets and the whole-bundle budget (GRAPHICS_PLAN: about 8 MB, lazy per scene).
FILE_BUDGET = {"building": 80_000, "avatar": 40_000, "host": 80_000, "interior": 150_000, "board": 250_000}
BUNDLE_BUDGET = 8_000_000
QUALITIES = (84, 80, 76, 72, 68, 64, 60)


def load_jobs() -> dict[str, dict]:
    path = WORK / "jobs.json"
    if not path.exists():
        sys.exit("work/jobs.json is missing (pnpm art:gen:guides --pilot)")
    return {j["slug"]: j for j in json.loads(path.read_text())["jobs"]}


def candidates(slug: str) -> list[Path]:
    return sorted((WORK / "out" / slug).glob("seed*.png"), key=lambda p: int(p.stem[4:]))


def score_of(slug: str, seed: int) -> str:
    path = WORK / "ranking.json"
    if not path.exists():
        return ""
    for score, s in json.loads(path.read_text()).get(slug, []):
        if s == seed:
            return f" · score {score:+.2f}"
    return ""


def cmd_contact(_: argparse.Namespace) -> int:
    jobs = load_jobs()
    rows = []
    for slug, job in jobs.items():
        cells = [f'<figure><img src="{html.escape(job["guide"])}"><figcaption>guide</figcaption></figure>']
        for c in candidates(slug):
            rel = c.relative_to(WORK).as_posix()
            cells.append(f'<figure><img src="{html.escape(rel)}"><figcaption>seed {c.stem[4:]}{score_of(slug, int(c.stem[4:]))}</figcaption></figure>')
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
    if args.best:
        rpath = WORK / "ranking.json"
        if not rpath.exists():
            sys.exit("run `python promote.py rank` first")
        for slug, rows in json.loads(rpath.read_text()).items():
            if rows:
                approved[slug] = rows[0][1]
    if args.all is not None:
        # Approve one seed for every slot that has it; individual picks below still override.
        for slug in jobs:
            if (WORK / "out" / slug / f"seed{args.all}.png").exists():
                approved[slug] = args.all
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


def _edges(img: Image.Image):
    """Boolean edge map of an image (Canny when OpenCV is installed, else a Pillow gradient)."""
    import numpy as np

    gray = img.convert("L")
    try:
        import cv2

        return cv2.Canny(np.array(gray), 80, 180) > 0
    except ImportError:
        e = gray.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 30 else 0)
        return np.array(e) > 0


def _near(mask, radius: int):
    """Pixels within `radius` of a True pixel of mask."""
    import numpy as np

    img = Image.fromarray((mask * 255).astype("uint8"))
    return np.array(img.filter(ImageFilter.MaxFilter(radius * 2 + 1))) > 0


def fidelity(candidate: Path, guide: Path) -> dict[str, float]:
    """How well a candidate keeps the SVG's layout, and how much clutter it adds.

    recall: share of the guide's edges that have a candidate edge close by (shape kept).
    clutter: share of the candidate's edges far from any guide edge (extra windows, objects, text).
    score: recall minus half the clutter; higher is better. A heuristic to rank, not a verdict.
    """
    cand = Image.open(candidate).convert("RGB")
    g = Image.open(guide).convert("RGBA").resize(cand.size, Image.LANCZOS)
    flat = Image.new("RGBA", g.size, (255, 255, 255, 255))
    flat.alpha_composite(g)
    guide_edges = _edges(flat.convert("RGB"))
    cand_edges = _edges(cand)
    r = max(3, cand.size[0] // 100)
    recall = float((guide_edges & _near(cand_edges, r)).sum()) / max(1, int(guide_edges.sum()))
    near_guide = _near(guide_edges, r * 2)
    clutter = float((cand_edges & ~near_guide).sum()) / max(1, int(cand_edges.sum()))
    return {"recall": round(recall, 3), "clutter": round(clutter, 3), "score": round(recall - 0.5 * clutter, 3)}


def cmd_rank(_: argparse.Namespace) -> int:
    jobs = load_jobs()
    ranking: dict[str, list[tuple[float, int]]] = {}
    for slug, job in jobs.items():
        rows = []
        for c in candidates(slug):
            f = fidelity(c, WORK / job["guide"])
            rows.append((f["score"], int(c.stem[4:])))
            print(f"{slug:36s} seed{c.stem[4:]:>3s}  score {f['score']:+.3f}  (layout kept {f['recall']:.2f}, clutter {f['clutter']:.2f})")
        ranking[slug] = sorted(rows, reverse=True)
    (WORK / "ranking.json").write_text(json.dumps(ranking, indent=2) + "\n")
    print("work/ranking.json written. Approve the best of each with:  python promote.py pick --best")
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
        # A small, deterministic lift: brighter and more vivid than the model tends to paint.
        image = ImageEnhance.Color(image).enhance(args.saturation)
        image = ImageEnhance.Brightness(image).enhance(args.brightness)
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
            "colour": {"saturation": args.saturation, "brightness": args.brightness},
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
    sub.add_parser("rank", help="score candidates for layout fidelity and clutter").set_defaults(fn=cmd_rank)
    pk = sub.add_parser("pick")
    pk.add_argument("picks", nargs="*", help="slug=seed, e.g. building.bank=2")
    pk.add_argument("--best", action="store_true", help="approve the top-ranked seed of every slot (run rank first)")
    pk.add_argument("--all", type=int, metavar="SEED", help="approve this seed for every slot that has it")
    pk.set_defaults(fn=cmd_pick)
    b = sub.add_parser("build")
    b.add_argument("--grow", type=int, default=6, help="pixels the SVG silhouette is grown before cutting out")
    b.add_argument("--saturation", type=float, default=1.15, help="colour boost (1 = none)")
    b.add_argument("--brightness", type=float, default=1.05, help="brightness boost (1 = none)")
    b.add_argument("--feather", type=float, default=2.0, help="edge softness in pixels")
    b.set_defaults(fn=cmd_build)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("sheet").set_defaults(fn=cmd_sheet)
    sub.add_parser("zip").set_defaults(fn=cmd_zip)
    args = p.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
