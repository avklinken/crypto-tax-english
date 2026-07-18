#!/usr/bin/env python3
import os
import re
from pathlib import Path
from urllib.parse import quote_plus

# Set this if your articles are not in /content.
BLOG_DIR = Path(os.getenv("BLOG_DIR", "content"))

ALLOWED_EXTENSIONS = {".md", ".markdown", ".html", ".htm", ".txt"}

# Matches:
# src="https://example.com"
# src="https://example.com/image.jpg"
EXAMPLE_SRC_RE = re.compile(
  r'''src\s*=\s*(['"])https?://example\.com(?:/[^'"]*)?\1''',
  re.IGNORECASE,
)

# Matches markdown image links:
# ![alt](https://example.com/image.jpg)
EXAMPLE_MD_IMAGE_RE = re.compile(
  r'''!\[([^\]]*)\]\(\s*https?://example\.com(?:/[^\)]*)?\s*\)''',
  re.IGNORECASE,
)

TITLE_LINE_RE = re.compile(r"^\s*title\s*:\s*(.+)\s*$", re.IGNORECASE)


def slug_to_title(slug: str) -> str:
  parts = re.split(r"[-_]+", slug.strip())
  parts = [p for p in parts if p]
  return " ".join(parts).title() if parts else "Untitled Article"


def unsplash_url_from_slug(slug: str) -> str:
  tokens = [t for t in re.split(r"[-_]+", slug.lower()) if t]
  core = " ".join(tokens[:4]) if tokens else "crypto tax"
  query = f"{core} crypto tax finance blockchain"
  return f"https://source.unsplash.com/1600x900/?{quote_plus(query)}"


def split_front_matter(text: str):
  if not text.startswith("---\n"):
    return "", text, False

  lines = text.splitlines(keepends=True)
  end_idx = None
  for i in range(1, len(lines)):
    if lines[i].strip() == "---":
      end_idx = i
      break

  if end_idx is None:
    return "", text, False

  fm = "".join(lines[: end_idx + 1]) + "\n"
  body = "".join(lines[end_idx + 1 :]).lstrip("\n")
  return fm, body, True


def ensure_front_matter_title(front_matter: str, title: str) -> str:
  lines = front_matter.splitlines()
  if not lines or lines[0].strip() != "---":
    return f"---\ntitle: \"{title}\"\n---\n"

  found = False
  for i in range(1, len(lines) - 1):
    match = TITLE_LINE_RE.match(lines[i])
    if not match:
      continue
    value = match.group(1).strip().strip('"').strip("'")
    if value:
      found = True
    else:
      lines[i] = f'title: "{title}"'
      found = True
    break

  if not found:
    lines.insert(len(lines) - 1, f'title: "{title}"')

  return "\n".join(lines) + "\n"


def ensure_h1(body: str, title: str) -> str:
  for line in body.splitlines():
    if line.strip().startswith("# "):
      return body
  return f"# {title}\n\n{body.lstrip()}"


def replace_example_images(text: str, image_url: str) -> str:
  text = EXAMPLE_SRC_RE.sub(lambda m: f'src={m.group(1)}{image_url}{m.group(1)}', text)
  text = EXAMPLE_MD_IMAGE_RE.sub(lambda m: f'![{m.group(1)}]({image_url})', text)
  return text


def fix_file(path: Path) -> bool:
  original = path.read_text(encoding="utf-8")
  slug = path.stem
  title = slug_to_title(slug)
  image_url = unsplash_url_from_slug(slug)
  updated = original

  if path.suffix.lower() in {".md", ".markdown", ".txt"}:
    fm, body, has_fm = split_front_matter(updated)

    if has_fm:
      fm = ensure_front_matter_title(fm, title)
    else:
      fm = f"---\ntitle: \"{title}\"\nslug: \"{slug}\"\n---\n"
      body = updated

    body = ensure_h1(body, title)
    body = replace_example_images(body, image_url)
    updated = fm + "\n" + body.lstrip()
  else:
    updated = replace_example_images(updated, image_url)

    if not re.search(r"<h1\b[^>]*>.*?</h1>", updated, re.IGNORECASE | re.DOTALL):
      if re.search(r"<body[^>]*>", updated, re.IGNORECASE):
        updated = re.sub(
          r"(<body[^>]*>)",
          rf"\1\n<h1>{title}</h1>\n",
          updated,
          count=1,
          flags=re.IGNORECASE,
        )
      else:
        updated = f"<h1>{title}</h1>\n" + updated

  if updated != original:
    path.write_text(updated, encoding="utf-8")
    return True
  return False


def main():
  if not BLOG_DIR.exists():
    raise SystemExit(f"Blog folder not found: {BLOG_DIR}")

  changed = 0
  scanned = 0

  for file_path in BLOG_DIR.rglob("*"):
    if not file_path.is_file():
      continue
    if file_path.suffix.lower() not in ALLOWED_EXTENSIONS:
      continue

    scanned += 1
    if fix_file(file_path):
      changed += 1
      print(f"Updated: {file_path}")

  print(f"Scanned: {scanned} file(s), changed: {changed} file(s).")


if __name__ == "__main__":
  main()
