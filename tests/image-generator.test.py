"""Regression for rebuilding derivatives after a source photo changes."""
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from importlib.util import module_from_spec, spec_from_file_location
from io import BytesIO
from pathlib import Path
import os
import tempfile
import threading
import unittest
from urllib.request import urlopen

from PIL import Image

SOURCE = Path(__file__).resolve().parents[1]
REPORT_TMP = SOURCE.parent / "reports" / "test-ownedtmp"
SCRIPT = Path(os.environ.get("RESPONSIVE_IMAGE_GENERATOR", SOURCE / "tools" / "build-responsive-images.py"))
SPEC = spec_from_file_location("responsive_images", SCRIPT)
MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


class RebuildTest(unittest.TestCase):
    def setUp(self):
        MODULE.SOURCE_STATE = {}
        MODULE.NEXT_SOURCE_STATE = {}
        MODULE.ORIGINAL_PATHS = set()

    def test_replaced_original_changes_served_derivative_and_unchanged_run_is_idempotent(self):
        REPORT_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="image-generator-", dir=REPORT_TMP) as directory:
            root = Path(directory).resolve()
            self.assertTrue(root.is_relative_to(REPORT_TMP.resolve()))
            photos = root / "assets" / "images" / "projects"
            photos.mkdir(parents=True)
            source = photos / "fixture.jpg"
            MODULE.ROOT = root
            server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root)))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                Image.new("RGB", (800, 400), (200, 20, 20)).save(source, "JPEG", quality=95)
                original_before = source.read_bytes()
                candidates = MODULE.variants(source)
                self.assertEqual(
                    {Path(path).name for path, _ in candidates},
                    {"fixture-360.webp", "fixture-720.webp", "fixture.webp"},
                )
                self.assertEqual(source.read_bytes(), original_before)
                path = next(path for path, width in candidates if width == 360)
                derivative = root / path
                url = f"http://127.0.0.1:{server.server_port}/{path}"
                with urlopen(url) as response:
                    first = response.read()
                first_digest = sha256(first).digest()

                Image.new("RGB", (800, 400), (20, 20, 200)).save(source, "JPEG", quality=95)
                replacement = source.read_bytes()
                MODULE.variants(source)
                self.assertEqual(source.read_bytes(), replacement)
                with urlopen(url) as response:
                    second = response.read()
                self.assertNotEqual(sha256(second).digest(), first_digest)
                with Image.open(BytesIO(second)) as photo:
                    red, _, blue = photo.getpixel((180, 90))
                    self.assertGreater(blue, red)

                generated = {root / path for path, _ in candidates}
                expected_bytes = {path: path.read_bytes() for path in generated}
                modified = {path: path.stat().st_mtime_ns for path in generated}
                MODULE.variants(source)
                self.assertEqual({path: path.stat().st_mtime_ns for path in generated}, modified)
                self.assertEqual({path: path.read_bytes() for path in generated}, expected_bytes)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_existing_720_stays_intact_until_its_original_changes(self):
        REPORT_TMP.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="image-generator-", dir=REPORT_TMP) as directory:
            root = Path(directory).resolve()
            self.assertTrue(root.is_relative_to(REPORT_TMP.resolve()))
            photos = root / "assets" / "images" / "projects"
            photos.mkdir(parents=True)
            source = photos / "condition.webp"
            medium = photos / "condition-720.webp"
            Image.new("RGB", (1448, 1086), (200, 20, 20)).save(source, "WEBP", quality=80)
            Image.new("RGB", (720, 540), (30, 200, 30)).save(medium, "WEBP", quality=75)
            original = source.read_bytes()
            existing = medium.read_bytes()
            MODULE.ROOT = root
            MODULE.SOURCE_STATE = {}
            MODULE.NEXT_SOURCE_STATE = {}
            MODULE.ORIGINAL_PATHS = {source.resolve()}
            MODULE.variants(source)
            self.assertEqual(medium.read_bytes(), existing)
            self.assertEqual(source.read_bytes(), original)

            MODULE.SOURCE_STATE = MODULE.NEXT_SOURCE_STATE.copy()
            MODULE.NEXT_SOURCE_STATE = {}
            Image.new("RGB", (1448, 1086), (20, 20, 200)).save(source, "WEBP", quality=80)
            replacement = source.read_bytes()
            MODULE.variants(source)
            self.assertEqual(source.read_bytes(), replacement)
            self.assertNotEqual(medium.read_bytes(), existing)
            with Image.open(medium) as photo:
                red, _, blue = photo.getpixel((360, 270))
                self.assertGreater(blue, red)
            modified = medium.stat().st_mtime_ns
            MODULE.SOURCE_STATE = MODULE.NEXT_SOURCE_STATE.copy()
            MODULE.NEXT_SOURCE_STATE = {}
            MODULE.variants(source)
            self.assertEqual(medium.stat().st_mtime_ns, modified)


if __name__ == "__main__":
    unittest.main()
