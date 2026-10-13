"""Reproducibly extract the original atlas without rewriting Turkish source text.

Usage: python scripts/extract-atlas.py [path/to/source.pptx]
The source PPTX is read only. Requires Pillow for image metadata.
"""
from __future__ import annotations

import collections
import hashlib
import io
import json
import pathlib
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

from PIL import Image

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / "Downloads/WoW_Retail_Hikaye_Atlasi.pptx"
EMU = 914400
CHAPTERS = [
    ("giris", -1, "Giriş", 1, "Atlas rehberi"),
    ("onsoz", 0, "Önsöz", 5, "Çağlar boyu"),
    ("vanilla", 1, "Vanilla", 14, "2004–2006"),
    ("the-burning-crusade", 2, "The Burning Crusade", 32, "2007–2008"),
    ("wrath-of-the-lich-king", 3, "Wrath of the Lich King", 49, "2008–2010"),
    ("cataclysm", 4, "Cataclysm", 65, "2010–2012"),
    ("mists-of-pandaria", 5, "Mists of Pandaria", 88, "2012–2014"),
    ("warlords-of-draenor", 6, "Warlords of Draenor", 111, "2014–2016"),
    ("legion", 7, "Legion", 131, "2016–2018"),
    ("battle-for-azeroth", 8, "Battle for Azeroth", 154, "2018–2020"),
    ("shadowlands", 9, "Shadowlands", 181, "2020–2022"),
    ("dragonflight", 10, "Dragonflight", 211, "2022–2024"),
    ("the-war-within", 11, "The War Within", 240, "2024–2026"),
    ("midnight", 12, "Midnight", 268, "2026–2027"),
    ("the-last-titan", 13, "The Last Titan", 304, "2027+"),
    ("butun-resim", 14, "Bütün resim", 313, "Sonuç"),
    ("kaynaklar", 15, "Kaynaklar", 326, "Referanslar"),
]


def paragraphs(element):
    result = []
    for para in element.findall(".//a:p", NS):
        text = "".join("\n" if n.tag == f"{{{NS['a']}}}br" else n.text or "" for n in para.iter() if n.tag in (f"{{{NS['a']}}}t", f"{{{NS['a']}}}br"))
        if text.strip():
            result.append(text)
    return result


def geometry(element):
    transform = element.find(".//a:xfrm", NS)
    if transform is None:
        transform = element.find(".//p:xfrm", NS)
    def attr(tag, key):
        child = transform.find(f"a:{tag}", NS) if transform is not None else None
        return round(int(child.get(key, "0")) / EMU, 4) if child is not None else 0
    return {"x": attr("off", "x"), "y": attr("off", "y"), "width": attr("ext", "cx"), "height": attr("ext", "cy")}


def relationships(archive, name):
    filename = posixpath.join(posixpath.dirname(name), "_rels", posixpath.basename(name) + ".rels")
    if filename not in archive.namelist():
        return {}
    result = {}
    for rel in ET.fromstring(archive.read(filename)):
        target = rel.get("Target", "")
        if rel.get("TargetMode") != "External":
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
        result[rel.get("Id")] = {"target": target, "type": rel.get("Type", "").rsplit("/", 1)[-1], "external": rel.get("TargetMode") == "External"}
    return result


def main():
    output = ROOT / "src/data/atlas.json"
    media_dir = ROOT / "public/assets/source"
    output.parent.mkdir(parents=True, exist_ok=True)
    media_dir.mkdir(parents=True, exist_ok=True)
    slides = []
    images = []
    source_paragraphs = 0
    table_count = 0
    notes_count = 0
    with zipfile.ZipFile(SOURCE) as archive:
        slide_names = sorted((n for n in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=lambda n: int(re.search(r"slide(\d+)", n)[1]))
        for name in archive.namelist():
            if not name.startswith("ppt/media/") or name.endswith("/"):
                continue
            binary = archive.read(name)
            filename = pathlib.PurePosixPath(name).name
            (media_dir / filename).write_bytes(binary)
            with Image.open(io.BytesIO(binary)) as img:
                width, height = img.size
            images.append({"src": "/assets/source/" + filename, "name": filename, "width": width, "height": height, "bytes": len(binary), "sha256": hashlib.sha256(binary).hexdigest()})
        media_lookup = {x["name"]: x for x in images}
        for number, name in enumerate(slide_names, 1):
            root = ET.fromstring(archive.read(name))
            rels = relationships(archive, name)
            raw = paragraphs(root)
            source_paragraphs += len(raw)
            groups = []
            pictures = []
            links = []
            title = ""
            for order, shape in enumerate(root.find(".//p:spTree", NS)):
                meta = shape.find(".//p:cNvPr", NS)
                identity = meta.get("id", str(order)) if meta is not None else str(order)
                name_attr = meta.get("name", "") if meta is not None else ""
                ph = shape.find(".//p:ph", NS)
                ph_type = ph.get("type") if ph is not None else None
                text = paragraphs(shape)
                if text:
                    role = "body"
                    if ph_type in ("title", "ctrTitle"):
                        role = "title"
                        title = "\n".join(text)
                    elif ph_type == "sldNum" or name_attr.startswith("Slide Number"):
                        role = "pageNumber"
                    elif not title:
                        role = "chapterNumber" if len(text) == 1 and text[0].isdigit() else "kicker"
                    sizes = [int(p.get("sz")) / 100 for p in shape.findall(".//a:rPr", NS) if p.get("sz")]
                    group = {"id": f"{number}-{order}-{identity}", "sourceId": identity, "name": name_attr, "role": role, "texts": text, "order": order, "fontSize": max(sizes, default=0), **geometry(shape)}
                    table = shape.find(".//a:tbl", NS)
                    if table is not None:
                        group["role"] = "table"
                        group["tableRows"] = [["\n".join(paragraphs(cell)) for cell in row.findall("a:tc", NS)] for row in table.findall("a:tr", NS)]
                        table_count += 1
                    groups.append(group)
                for blip in shape.findall(".//a:blip", NS):
                    rel = rels.get(blip.get(f"{{{NS['r']}}}embed"), {})
                    filename = pathlib.PurePosixPath(rel.get("target", "")).name
                    if filename in media_lookup:
                        asset = media_lookup[filename]
                        pictures.append({"src": asset["src"], "alt": meta.get("descr", name_attr) if meta is not None else "", "width": asset["width"], "height": asset["height"], "position": geometry(shape)})
                for hyperlink in shape.findall(".//a:hlinkClick", NS):
                    rel = rels.get(hyperlink.get(f"{{{NS['r']}}}id"), {})
                    if rel.get("target"):
                        links.append({"text": "\n".join(text), "url": rel["target"], "type": "external" if rel.get("external") else "internal"})
            notes = []
            notes_raw = []
            for rel in rels.values():
                if rel["type"] != "notesSlide":
                    continue
                notes_root = ET.fromstring(archive.read(rel["target"]))
                notes_raw = paragraphs(notes_root)
                for shape in notes_root.findall(".//p:sp", NS):
                    ph = shape.find(".//p:ph", NS)
                    if ph is None or ph.get("type") not in ("sldNum", "hdr", "ftr", "dt"):
                        notes.extend(paragraphs(shape))
            notes_count += len(notes)
            # The reference slides use literal URLs instead of hyperlink relationships.
            # Keep their labels verbatim; only make complete printed URLs clickable.
            for para in raw:
                for match in re.finditer(r"(?:https?://)?(?:[A-Za-z0-9-]+\.)+(?:com|org|net|gg|de)(?:/[^\s<>·]*)?", para):
                    literal = match.group(0).rstrip(".,;)")
                    if "…" in literal or (match.end() < len(para) and para[match.end()] == "<"):
                        continue
                    url = literal if literal.startswith("http") else "https://" + literal
                    if not any(link["url"] == url for link in links):
                        links.append({"text": literal, "url": url, "type": "printed"})
            chapter = next(c for c in reversed(CHAPTERS) if c[3] <= number)
            slides.append({"number": number, "id": f"sayfa-{number}", "title": title, "chapterId": chapter[0], "kicker": next(("\n".join(g["texts"]) for g in groups if g["role"] == "kicker"), ""), "isChapterCover": number == chapter[3] and chapter[1] in range(15), "paragraphs": raw, "groups": groups, "notes": notes, "notesRaw": notes_raw, "images": pictures, "links": links})
            extracted = [text for group in groups for text in group["texts"]]
            assert collections.Counter(extracted) == collections.Counter(raw), f"Lost source paragraphs on slide {number}"
        chapters = []
        for i, (identity, index, title, start, period) in enumerate(CHAPTERS):
            end = CHAPTERS[i + 1][3] - 1 if i + 1 < len(CHAPTERS) else len(slides)
            cover = slides[start - 1]
            body = [g for g in cover["groups"] if g["role"] == "body"]
            chapters.append({"id": identity, "index": index, "title": title, "start": start, "end": end, "subtitle": "\n".join(body[0]["texts"]) if body else "", "period": period, "coverImage": cover["images"][0]["src"] if cover["images"] else None})

    data = {"title": "World of Warcraft Retail · Hikâye Atlası", "source": {"filename": SOURCE.name, "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "slideCount": len(slides), "paragraphCount": source_paragraphs, "tableCount": table_count, "noteParagraphCount": notes_count, "imageCount": len(images), "dateLabel": "Ekim 2026", "textPolicy": "Kaynak sunumdaki Türkçe içerik değiştirilmeden aktarılmıştır."}, "chapters": chapters, "slides": slides, "images": images}
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    assert all((ROOT / "public" / pic["src"].lstrip("/")).is_file() for slide in slides for pic in slide["images"])
    assert len(slides) == len(slide_names)
    repeated_numbers = sum(len(g["texts"]) for s in slides for g in s["groups"] if g["role"] == "pageNumber")
    unique_image_count = len({im["sha256"] for im in images})
    audit = ["# Source content audit", "", f"Source: `{SOURCE.name}`", f"SHA-256: `{data['source']['sha256']}`", "", "The source file was read only and was not modified. The site is an adaptation of this supplied atlas; its lore and date claims have not been independently fact checked by this extraction step.", "", "## Coverage", "", f"- {len(slides)} of {len(slides)} slides retained in source order.", f"- {source_paragraphs} nonempty slide paragraphs retained verbatim, including titles, labels, table cells and {repeated_numbers} page-number paragraphs.", f"- {table_count} native tables retained with `tableRows`, including row and column order.", f"- {notes_count} meaningful note paragraphs retained in `notes`; `notesRaw` also retains note page numbers.", f"- {len(images)} original embedded PNG files extracted byte-for-byte ({unique_image_count} unique SHA-256 hashes). Every image is 256 × 256 pixels and serves as an icon. These are not suitable as full-width hero artwork.", "- No content paragraphs excluded. Only empty paragraphs were omitted. Readers may hide groups whose `role` is `pageNumber`, `kicker` or `chapterNumber` when equivalent navigation is already visible; all remain in the JSON.", "- Turkish Unicode, punctuation, proper names and source wording were preserved. Text runs within each paragraph were concatenated, soft breaks retained as newline characters.", "- Shape groups retain the source logical document order, `order` and source x/y/width/height in inches. This preserves column/card group text adjacency without reordering rows merely by y-coordinate.", "- Source URLs printed as text remain exactly as supplied, including partial and template URLs. Embedded hyperlinks are also retained separately when present; no missing or abbreviated URLs were invented.", "", "## Chapter index", "", "| Chapter | Pages | Period |", "| --- | --- | --- |"]
    audit.insert(audit.index("## Chapter index"), f"The deck has no embedded hyperlink relationships. Its {sum(len(s['links']) for s in slides)} complete literal URL occurrences are exposed as `links` entries with `type: printed`; full source paragraphs still retain abbreviated paths and URL templates as text. URLs are extraction results, not a verification of destination availability.\n")
    audit.extend(f"| {c['title']} | {c['start']}–{c['end']} | {c['period']} |" for c in chapters)
    audit += ["", "## Slide index", "", "| Page | Title | Paragraphs | Tables |", "| --- | --- | ---: | ---: |"]
    audit.extend(f"| {s['number']} | {s['title']} | {len(s['paragraphs'])} | {sum(g['role'] == 'table' for g in s['groups'])} |" for s in slides)
    audit_path = ROOT / "docs/source-content-audit.md"
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text("\n".join(audit) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "slides": len(slides), "paragraphs": source_paragraphs, "tables": table_count, "noteParagraphs": notes_count, "images": len(images), "uniqueImages": unique_image_count, "jsonBytes": output.stat().st_size, "imageBytes": sum(i['bytes'] for i in images)}, ensure_ascii=False))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
