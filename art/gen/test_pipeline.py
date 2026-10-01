"""Tests for the parts of the pipeline that need no model: edge maps, cut-out, budgets, bundle.

    cd art/gen && python3 -m unittest test_pipeline        (needs Pillow and NumPy)

Candidates are stood in for by the guide images with noise added, so the packaging code runs on
realistic-sized RGBA, RGB and WebP data without downloading a model.
"""
import json
import random
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from PIL import Image

import generate
import promote


def fake_workspace(tmp: Path) -> None:
    """Two jobs: an object with a silhouette (alpha) and a full-frame scene."""
    (tmp / "guides").mkdir(parents=True)
    obj = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    obj.paste((120, 40, 40, 255), (64, 64, 192, 192))  # a square "building"
    obj.save(tmp / "guides/building.test.png")
    Image.new("RGBA", (320, 200), (200, 200, 200, 255)).save(tmp / "guides/interior.test.png")
    jobs = [
        {"key": "building:test", "slug": "building.test", "kind": "building", "alpha": True,
         "guide": "guides/building.test.png", "genWidth": 256, "genHeight": 256,
         "outWidth": 128, "outHeight": 128, "logicalWidth": 240, "logicalHeight": 240,
         "prompt": "p", "negative": "n"},
        {"key": "interior:test", "slug": "interior.test", "kind": "interior", "alpha": False,
         "guide": "guides/interior.test.png", "genWidth": 320, "genHeight": 200,
         "outWidth": 320, "outHeight": 200, "logicalWidth": 1600, "logicalHeight": 1000,
         "prompt": "p", "negative": "n"},
    ]
    (tmp / "jobs.json").write_text(json.dumps({"jobs": jobs}))
    rnd = random.Random(1)
    for slug, size in (("building.test", (256, 256)), ("interior.test", (320, 200))):
        d = tmp / "out" / slug
        d.mkdir(parents=True)
        img = Image.effect_noise(size, 40).convert("RGB")  # grey noise stands in for a painting
        img.save(d / "seed1.png")
        (d / "seed1.json").write_text(json.dumps({"key": slug, "seed": 1, "prompt": "p"}))


class Pipeline(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        root = Path(self.dir.name)
        promote.WORK = root / "work"
        promote.BUNDLE = root / "bundles" / "realistic"
        fake_workspace(promote.WORK)

    def tearDown(self) -> None:
        self.dir.cleanup()

    def build(self) -> int:
        promote.cmd_pick(SimpleNamespace(picks=["building.test=1", "interior.test=1"]))
        return promote.cmd_build(SimpleNamespace(grow=2, feather=1.0))

    def test_build_and_check_pass(self) -> None:
        self.assertEqual(self.build(), 0)
        self.assertEqual(promote.cmd_check(SimpleNamespace()), 0)
        bundle = json.loads((promote.BUNDLE / "bundle.json").read_text())
        self.assertEqual(sorted(bundle["assets"]), ["building:test", "interior:test"])
        self.assertTrue((promote.BUNDLE / "provenance.json").exists())

    def test_object_is_cut_out_with_the_guide_silhouette(self) -> None:
        self.build()
        im = Image.open(promote.BUNDLE / "files/building.test.webp")
        self.assertEqual(im.size, (128, 128))
        self.assertEqual(im.getpixel((2, 2))[3], 0, "outside the silhouette is transparent")
        self.assertGreater(im.getpixel((64, 64))[3], 250, "inside is opaque")
        scene = Image.open(promote.BUNDLE / "files/interior.test.webp")
        self.assertNotIn("A", scene.getbands(), "scenes keep the full frame")

    def test_budget_failure_is_reported(self) -> None:
        self.build()
        promote.FILE_BUDGET["building"] = 10  # impossible
        try:
            self.assertEqual(promote.cmd_check(SimpleNamespace()), 1)
        finally:
            promote.FILE_BUDGET["building"] = 80_000

    def test_bad_pick_is_rejected(self) -> None:
        with self.assertRaises(SystemExit):
            promote.cmd_pick(SimpleNamespace(picks=["building.test=9"]))

    def test_contact_sheet_and_zip(self) -> None:
        self.build()
        promote.cmd_contact(SimpleNamespace())
        promote.cmd_sheet(SimpleNamespace())
        promote.cmd_zip(SimpleNamespace())
        self.assertTrue((promote.WORK / "contact.html").exists())
        self.assertTrue((promote.BUNDLE.parent / "realistic-bundle.zip").exists())


class EdgeMap(unittest.TestCase):
    def test_edges_follow_the_silhouette(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            guide = Path(d) / "g.png"
            img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            img.paste((10, 10, 10, 255), (32, 32, 96, 96))
            img.save(guide)
            edges = generate.edge_map(guide, (128, 128))
            self.assertEqual(edges.size, (128, 128))
            self.assertEqual(edges.getpixel((64, 64)), (0, 0, 0), "flat interior has no edge")
            self.assertGreater(max(edges.getpixel((32, y))[0] for y in range(40, 90)), 200, "outline is white")


if __name__ == "__main__":
    unittest.main()
