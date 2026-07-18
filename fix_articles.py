#!/usr/bin/env python3
import glob
import os
import re
from pathlib import Path

MAP_PAD = "content"
PIXABAY_TECH_URL = "https://pixabay.com"
ALLOWED_EXTENSIONS = {".md", ".markdown", ".txt", ".html", ".htm"}

IMG_TAG_RE = re.compile(r"<img\b[^>]*>", re.IGNORECASE | re.DOTALL)
SRC_RE = re.compile(r'''src\s*=\s*(['"])(.*?)\1''', re.IGNORECASE | re.DOTALL)
MD_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)", re.IGNORECASE)
BROKEN_IMAGE_RE = re.compile(r"(example\.com|source\.unsplash\.com|://unsplash\.com|pixabay\.com/?$)", re.IGNORECASE)


def slug_to_title(path: Path) -> str:
  slug = path.stem
  title = re.sub(r"[-_]+", " ", slug).strip()
  title = re.sub(r"\s+", " ", title)
  return title.title() if title else "Artikel"


def split_front_matter(text: str) -> tuple[str, str, bool]:
  if not text.startswith("---"):
    return "", text, False

  lines = text.splitlines(keepends=True)
  closing_index = None
  for idx in range(1, len(lines)):
    if lines[idx].strip() == "---":
      closing_index = idx
      break

  if closing_index is None:
    return "", text, False

  front_matter = "".join(lines[: closing_index + 1])
  body = "".join(lines[closing_index + 1 :]).lstrip("\n")
  return front_matter, body, True


def ensure_h1_near_top(body: str, title: str) -> str:
  lines = [line.strip() for line in body.splitlines() if line.strip()]
  top_block = "\n".join(lines[:20])

  if re.search(r"<h1\b[^>]*>.*?</h1>", top_block, re.IGNORECASE | re.DOTALL):
    return re.sub(
      r"^\s*<h1\b[^>]*>.*?</h1>\s*",
      f"<h1>{title}</h1>\n\n",
      body,
      count=1,
      flags=re.IGNORECASE | re.DOTALL,
    )

  if re.search(r"^\s*#\s+.+", top_block, re.IGNORECASE | re.MULTILINE):
    return re.sub(r"^\s*#\s+.+\n*", f"<h1>{title}</h1>\n\n", body, count=1, flags=re.IGNORECASE)

  return f"<h1>{title}</h1>\n\n{body.lstrip()}"


def strip_hiding_classes_from_img_tag(tag: str) -> str:
  class_match = re.search(r'''class\s*=\s*(['"])(.*?)\1''', tag, re.IGNORECASE | re.DOTALL)
  if not class_match:
    return tag

  quote = class_match.group(1)
  classes = [c for c in re.split(r"\s+", class_match.group(2).strip()) if c]
  filtered = [c for c in classes if c.lower() not in {"hidden", "opacity-0", "invisible"}]

  if filtered:
    replacement = f'class={quote}{" ".join(filtered)}{quote}'
    return tag[:class_match.start()] + replacement + tag[class_match.end():]

  return tag[:class_match.start()] + tag[class_match.end():]


def rewrite_html_img_tags(text: str) -> str:
  def replace(match: re.Match[str]) -> str:
    tag = strip_hiding_classes_from_img_tag(match.group(0))
    src_match = SRC_RE.search(tag)

    if not src_match:
      if tag.endswith("/>"):
        return tag[:-2] + f' src="{PIXABAY_TECH_URL}" />'
      if tag.endswith(">"):
        return tag[:-1] + f' src="{PIXABAY_TECH_URL}">'
      return tag

    src = src_match.group(2).strip()
    if BROKEN_IMAGE_RE.search(src):
      tag = SRC_RE.sub(lambda m: f'src={m.group(1)}{PIXABAY_TECH_URL}{m.group(1)}', tag, count=1)
    return tag

  return IMG_TAG_RE.sub(replace, text)


def rewrite_markdown_images(text: str) -> str:
  def replace(match: re.Match[str]) -> str:
    alt = match.group(1)
    src = match.group(2).strip()
    if BROKEN_IMAGE_RE.search(src):
      return f"![{alt}]({PIXABAY_TECH_URL})"
    return match.group(0)

  return MD_IMAGE_RE.sub(replace, text)


def repair_file(path: Path) -> bool:
  original = path.read_text(encoding="utf-8")
  title = slug_to_title(path)

  updated = re.sub(r"crypto-tax-blog", title, original, flags=re.IGNORECASE)
  front_matter, body, has_front_matter = split_front_matter(updated)
  body = ensure_h1_near_top(body, title)
  body = rewrite_html_img_tags(body)
  body = rewrite_markdown_images(body)

  updated = f"{front_matter}\n{body}" if has_front_matter else body

  if updated != original:
    path.write_text(updated, encoding="utf-8")
    return True
  return False


def iter_article_files(root: str) -> list[Path]:
  files: list[Path] = []
  patterns = ("*.md", "*.markdown", "*.txt", "*.html", "*.htm")

  for pattern in patterns:
    for file_path in glob.glob(os.path.join(root, "**", pattern), recursive=True):
      p = Path(file_path)
      if p.is_file() and p.suffix.lower() in ALLOWED_EXTENSIONS:
        files.append(p)

  return files


def main() -> None:
  if not os.path.isdir(MAP_PAD):
    raise SystemExit(f"Map not found: {MAP_PAD}")

  files = iter_article_files(MAP_PAD)
  changed_files: list[str] = []

  for article in files:
    if repair_file(article):
      changed_files.append(str(article))

  for changed in changed_files:
    print(f"Updated: {changed}")
  print(f"Scanned: {len(files)}, Updated: {len(changed_files)}")


if __name__ == "__main__":
  main()
