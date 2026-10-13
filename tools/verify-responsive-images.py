"""Check local content-image descriptors against the decoded image files."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
names = {"index.html"}
for item in ET.parse(ROOT / "sitemap.xml").iter():
    if item.tag.endswith("loc") and item.text:
        name = item.text.rstrip("/").rsplit("/", 1)[-1] or "index.html"
        if name.endswith(".html"):
            names.add(name)

images = 0
candidates = 0
paths = set()
for name in names:
    html = (ROOT / name).read_text(encoding="utf-8")
    for match in re.finditer(r'<img\b[^>]+>', html):
        tag = match.group()
        source = re.search(r'\bsrc="(assets/images/[^"]+\.(?:jpg|webp))"', tag)
        if not source:
            continue
        images += 1
        original = ROOT / source.group(1)
        assert original.is_file(), (name, original)
        with Image.open(original) as image:
            width = int(re.search(r'\bwidth="(\d+)"', tag).group(1))
            height = int(re.search(r'\bheight="(\d+)"', tag).group(1))
            assert (width, height) == image.size, (name, original, (width, height), image.size)
        prefix = html[max(0, match.start() - 600):match.start()]
        picture = re.search(r'<picture[^>]*><source[^>]*srcset="([^"]+)"[^>]*>$', prefix)
        srcset = re.search(r'\bsrcset="([^"]+)"', tag)
        value = srcset.group(1) if srcset else picture.group(1) if picture else None
        assert value, (name, source.group(1), "missing srcset")
        assert 'sizes="' in tag or picture and 'sizes="' in picture.group(), (name, source.group(1), "missing sizes")
        for path, declared in re.findall(r'([^,\s]+)\s+(\d+)w', value):
            candidate = ROOT / path
            assert candidate.is_file(), (name, path, "missing candidate")
            with Image.open(candidate) as image:
                assert image.width == int(declared), (name, path, declared, image.size)
                assert abs(image.width / image.height - width / height) < .02, (name, path, "aspect ratio")
            candidates += 1
            paths.add(path)

print(f"Validated {images} content-photo uses, {candidates} candidate references, {len(paths)} distinct files across {len(names)} sitemap pages.")
