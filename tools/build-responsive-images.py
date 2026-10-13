"""Rebuild responsive derivatives and project-photo markup from local originals.

Run with the bundled Python runtime that includes Pillow. Originals are read only.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "tools/responsive-image-state.json"
SOURCE_STATE = {}
NEXT_SOURCE_STATE = {}
ORIGINAL_PATHS = set()
GALLERY = "(max-width: 650px) calc((90vw - 8px)/2), (max-width: 960px) calc((90vw - 12px)/2), 424px"
HOME = "(max-width: 650px) calc((90vw - 8px)/2), (max-width: 850px) calc((90vw - 10px)/2), 350px"
HERO = "(max-width: 850px) 100vw, 64vw"
CARD = "(max-width: 650px) 90vw, (max-width: 1000px) 44vw, 350px"
OTHER = "(max-width: 850px) 90vw, 50vw"


def write_if_changed(output, data):
    if not output.exists() or output.read_bytes() != data:
        output.write_bytes(data)


def save_derivative(source, output, image):
    root = ROOT.resolve()
    source = source.resolve()
    output = output.resolve()
    if not source.is_relative_to(root) or not output.is_relative_to(root):
        raise ValueError("image path outside site source")
    if output.parent != source.parent or output == source or output in ORIGINAL_PATHS:
        raise ValueError(f"refusing to overwrite original image: {output}")
    if output.suffix.lower() != ".webp" or not (output.stem == source.stem or output.stem.startswith(source.stem + "-")):
        raise ValueError(f"unexpected derivative path: {output}")
    buffer = BytesIO()
    image.save(buffer, "WEBP", quality=80, method=6)
    write_if_changed(output, buffer.getvalue())


def variants(source):
    if source.stem.endswith("-720"):
        full = source.with_name(source.stem[:-4] + source.suffix)
        if full.is_file():
            smaller = variants(full)
            return [item for item in smaller if item[1] == 360] + [(source.relative_to(ROOT).as_posix(), 720)]
    with Image.open(source) as original:
        width, _ = original.size
        relative = source.relative_to(ROOT).as_posix()
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        prior_digest = SOURCE_STATE.get(relative)
        NEXT_SOURCE_STATE[relative] = digest
        candidates = []
        for target in (360, 720, 1440):
            if target == 1440 and width <= 1600:
                continue
            if target >= width:
                continue
            output = source.with_name(f"{source.stem}-{target}.webp")
            # Existing WebP 720s predate this tool. Keep them on first adoption
            # and while the original fingerprint is unchanged; rebuild on change.
            preserve_legacy_720 = source.suffix.lower() == ".webp" and target == 720 and output.exists() and (prior_digest is None or prior_digest == digest)
            if not preserve_legacy_720:
                image = original.convert("RGB")
                image.thumbnail((target, 10000), Image.Resampling.LANCZOS)
                save_derivative(source, output, image)
            candidates.append((output.relative_to(ROOT).as_posix(), target))
        if source.suffix.lower() == ".webp":
            candidates.append((source.relative_to(ROOT).as_posix(), width))
        else:
            output = source.with_suffix(".webp")
            save_derivative(source, output, original.convert("RGB"))
            candidates.append((output.relative_to(ROOT).as_posix(), width))
        return sorted(candidates, key=lambda item: item[1])


def main():
    global SOURCE_STATE, NEXT_SOURCE_STATE, ORIGINAL_PATHS
    SOURCE_STATE = json.loads(STATE_FILE.read_text(encoding="utf-8")) if STATE_FILE.exists() else {}
    NEXT_SOURCE_STATE = {}
    sitemap = ET.parse(ROOT / "sitemap.xml")
    pages = set()
    for item in sitemap.iter():
        if item.tag.endswith("loc") and item.text:
            name = item.text.rstrip("/").rsplit("/", 1)[-1] or "index.html"
            if name.endswith(".html"):
                pages.add(name)
    # The root URL has no filename in its sitemap location.
    pages.add("index.html")
    ORIGINAL_PATHS = set()
    for page_name in pages:
        page = ROOT / page_name
        if not page.is_file():
            continue
        html = page.read_text(encoding="utf-8")
        for src in re.findall(r'<img\b[^>]*\bsrc="(assets/images/[^"]+\.(?:jpg|webp))"', html):
            if not Path(src).stem.endswith("-720"):
                ORIGINAL_PATHS.add((ROOT / src).resolve())
    built = {}
    touched = []
    for page_name in sorted(pages):
        page = ROOT / page_name
        if not page.is_file():
            continue
        html = page.read_text(encoding="utf-8")
        before_html = html
        html = re.sub(r'<picture(?: style="[^"]*")?><source type="image/webp"[^>]*>(<img\b[^>]*src="assets/images/[^"]+\.jpg"[^>]*>)</picture>', r'\1', html)

        def replace(match):
            tag = match.group(0)
            found = re.search(r'\bsrc="(assets/images/[^\"]+\.(?:jpg|webp))"', tag)
            if not found:
                return tag
            src = found.group(1)
            source = ROOT / src
            if not source.is_file():
                raise FileNotFoundError(src)
            with Image.open(source) as original:
                actual_width, actual_height = original.size
            tag = re.sub(r'\bwidth="\d+"', f'width="{actual_width}"', tag)
            tag = re.sub(r'\bheight="\d+"', f'height="{actual_height}"', tag)
            if src not in built:
                built[src] = variants(source)
            candidates = built[src]
            srcset = ", ".join(f"{path} {width}w" for path, width in candidates)
            before = html[max(0, match.start()-250):match.start()]
            hero = bool(re.search(r'<figure class="page-hero__visual"[^>]*>\s*$', before))
            sizes = CARD if 'class="service-card__photo"' in tag else HERO if hero else HOME if page_name == "index.html" else GALLERY if '/projects/' in src else OTHER
            if source.suffix.lower() == ".webp":
                if re.search(r'\bsrcset="[^"]*"', tag):
                    tag = re.sub(r'\bsrcset="[^"]*"', f'srcset="{srcset}"', tag)
                else:
                    tag = tag[:-1] + f' srcset="{srcset}">'
                if re.search(r'\bsizes="[^"]*"', tag):
                    tag = re.sub(r'\bsizes="[^"]*"', f'sizes="{sizes}"', tag)
                else:
                    tag = tag[:-1] + f' sizes="{sizes}">'
                return tag
            # The JPEG remains the fallback and the full-size gallery link.
            wrapper = ' style="display:block;width:100%;height:100%"' if hero else ''
            return f'<picture{wrapper}><source type="image/webp" srcset="{srcset}" sizes="{sizes}">{tag}</picture>'

        updated = re.sub(r'<img\b[^>]+>', replace, html)
        if updated != before_html:
            page.write_text(updated, encoding="utf-8", newline="")
            touched.append(page_name)

    with Image.open(ROOT / "favicon-ellis-services.png") as icon:
        buffer = BytesIO()
        icon.convert("RGBA").resize((32, 32), Image.Resampling.LANCZOS).save(buffer, "PNG", optimize=True)
        write_if_changed(ROOT / "favicon-32.png", buffer.getvalue())
    index = ROOT / "index.html"
    html = index.read_text(encoding="utf-8")
    html = html.replace('<link rel="icon" type="image/png" sizes="512x512" href="/favicon-ellis-services.png">\n  <link rel="icon" href="/favicon-ellis-services.png" sizes="any">\n  <link rel="apple-touch-icon" href="/favicon-ellis-services.png">', '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n  <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">\n  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">')
    if html != index.read_text(encoding="utf-8"):
        index.write_text(html, encoding="utf-8", newline="")
    state = json.dumps({**SOURCE_STATE, **NEXT_SOURCE_STATE}, sort_keys=True, indent=2) + "\n"
    write_if_changed(STATE_FILE, state.encode("utf-8"))
    print(f"generated variants for {len(built)} originals; updated {len(touched)} pages: {', '.join(touched)}")


if __name__ == "__main__":
    main()
