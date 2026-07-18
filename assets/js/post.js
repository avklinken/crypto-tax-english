const SITE_URL = "https://www.taxcryptoguide.com";
const FALLBACK_IMAGE_POOL = [
  "https://picsum.photos/id/180/1200/675",
  "https://picsum.photos/id/0/1200/675",
  "https://picsum.photos/id/48/1200/675",
  "https://picsum.photos/id/96/1200/675",
  "https://picsum.photos/id/104/1200/675",
];

function getSlug() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("slug") || "").trim();
}

function stripHtmlTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function slugToTitle(slug) {
  const normalized = String(slug || "").replace(/[-_]+/g, " ").trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Crypto Tax Guide";
}

function isPlaceholderTitle(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "-");
  return !normalized || normalized === "crypto-tax-blog" || normalized === "blog" || normalized === "post";
}

function deterministicFallbackImage(seed) {
  const source = String(seed || "default");
  let score = 0;
  for (const ch of source) score += ch.charCodeAt(0);
  return FALLBACK_IMAGE_POOL[score % FALLBACK_IMAGE_POOL.length];
}

function resolveImageUrl(rawUrl, seed) {
  const url = String(rawUrl || "").trim();
  if (!url || /(example\.com|source\.unsplash\.com|:\/\/unsplash\.com|pixabay\.com\/?$)/i.test(url)) {
    return deterministicFallbackImage(seed);
  }
  return url;
}

function normalizeTitle(meta, slug, body) {
  const candidates = [meta.title, meta.h1, meta.post_title, meta.name, meta.meta_title];
  for (const candidate of candidates) {
    const clean = stripHtmlTags(candidate);
    if (!isPlaceholderTitle(clean)) return clean;
  }
  const heading = String(body || "").match(/^\s*#\s+(.+)$/m)?.[1];
  if (heading && !isPlaceholderTitle(heading)) return stripHtmlTags(heading);
  return slugToTitle(slug);
}

function estimateReadingTime(content) {
  const plain = stripHtmlTags(String(content || "").replace(/[#>*_`[\]()!-]/g, " "));
  const words = plain.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 220))} min reading time`;
}

function parseFrontMatter(markdown) {
  const lines = markdown.split("\n");
  if (lines[0]?.trim() !== "---") return { meta: {}, body: markdown };

  const meta = {};
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      closingIndex = i;
      break;
    }
    const separatorIndex = lines[i].indexOf(":");
    if (separatorIndex === -1) continue;
    const key = lines[i].slice(0, separatorIndex).trim();
    const rawValue = lines[i].slice(separatorIndex + 1).trim();
    if (!key) continue;
    try {
      meta[key] = JSON.parse(rawValue);
    } catch {
      meta[key] = rawValue.replace(/^"|"$/g, "");
    }
  }

  if (closingIndex === -1) return { meta: {}, body: markdown };
  return {
    meta,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, ""),
  };
}

function removeLeadingH1(content) {
  return String(content || "")
    .replace(/^\s*#\s+.+\n+/m, "")
    .replace(/^\s*<h1\b[^>]*>.*?<\/h1>\s*/im, "")
    .trim();
}

function extractImageFromContent(content) {
  const htmlMatch = String(content || "").match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (htmlMatch?.[1]) return htmlMatch[1];
  const mdMatch = String(content || "").match(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/);
  return mdMatch?.[1] || "";
}

function extractFromRenderedHtml(htmlText, slug) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");
  const container = doc.querySelector(".markdown-body");
  if (!container) return null;

  const repoHeading = container.querySelector("h1");
  if (repoHeading && repoHeading.querySelector("a")) repoHeading.remove();

  const bodyHtml = container.innerHTML.trim();
  if (!bodyHtml) return null;

  return {
    meta: {
      title: stripHtmlTags(doc.querySelector('meta[property="og:title"]')?.getAttribute("content")),
      h1: "",
      post_title: "",
      name: "",
      meta_title: stripHtmlTags(doc.querySelector("title")?.textContent),
      meta_description: stripHtmlTags(doc.querySelector('meta[name="description"]')?.getAttribute("content")),
      image_url: extractImageFromContent(bodyHtml),
      published_at: "",
      slug,
    },
    body: stripHtmlTags(container.textContent || ""),
    body_html: bodyHtml,
  };
}

function styleRenderedContent(contentEl, title) {
  contentEl.className = "text-slate-700";
  contentEl.querySelectorAll("h1").forEach((el) => {
    const h2 = document.createElement("h2");
    h2.innerHTML = el.innerHTML;
    h2.className = "mt-8 mb-4 text-3xl font-bold tracking-tight text-slate-900";
    el.replaceWith(h2);
  });
  contentEl.querySelectorAll("h2").forEach((el) => (el.className = "mt-8 mb-4 text-3xl font-bold tracking-tight text-slate-900"));
  contentEl.querySelectorAll("h3").forEach((el) => (el.className = "mt-6 mb-3 text-2xl font-bold tracking-tight text-slate-900"));
  contentEl.querySelectorAll("h4").forEach((el) => (el.className = "mt-6 mb-3 text-xl font-bold tracking-tight text-slate-900"));
  contentEl.querySelectorAll("p").forEach((el) => (el.className = "mb-6 leading-relaxed text-slate-700"));
  contentEl.querySelectorAll("ul").forEach((el) => (el.className = "mb-6 list-disc space-y-2 pl-5 text-slate-700"));
  contentEl.querySelectorAll("ol").forEach((el) => (el.className = "mb-6 list-decimal space-y-2 pl-5 text-slate-700"));
  contentEl.querySelectorAll("li").forEach((el) => el.classList.add("leading-relaxed"));
  contentEl.querySelectorAll("a").forEach((el) => {
    el.className = "font-semibold text-indigo-600 transition hover:underline";
    if (!el.getAttribute("rel")) el.setAttribute("rel", "noopener");
  });
  contentEl.querySelectorAll("blockquote").forEach((el) => (el.className = "mb-6 border-l-4 border-slate-300 pl-4 italic text-slate-600"));
  contentEl.querySelectorAll("img").forEach((img) => {
    img.src = resolveImageUrl(img.getAttribute("src"), `${title}|inline`);
    if (!img.getAttribute("alt") || !img.getAttribute("alt").trim()) img.setAttribute("alt", `Illustration for ${title}`);
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.className = "my-8 rounded-2xl border border-slate-200 shadow-sm";
  });
}

function setMetaTag(selector, content) {
  const el = document.querySelector(selector);
  if (el && content) el.setAttribute("content", content);
}

function applySeo(meta, title, description, slug) {
  const finalTitle = stripHtmlTags(title);
  const finalDescription = stripHtmlTags(description);
  const url = `${SITE_URL}/post.html?slug=${encodeURIComponent(slug)}`;
  document.title = `${finalTitle} | TaxCryptoGuide`;
  setMetaTag('meta[name="description"]', finalDescription);
  setMetaTag('meta[property="og:title"]', finalTitle);
  setMetaTag('meta[property="og:description"]', finalDescription);
  setMetaTag('meta[property="og:type"]', "article");
  setMetaTag('meta[property="og:url"]', url);
  setMetaTag('meta[property="og:site_name"]', "TaxCryptoGuide");
  const canonical = document.getElementById("canonical-link");
  if (canonical) canonical.setAttribute("href", url);
}

function extractMarkdownDocument(markdownText, fallbackSlug) {
  const { meta, body } = parseFrontMatter(markdownText);
  return {
    meta: {
      title: stripHtmlTags(meta.title || ""),
      h1: stripHtmlTags(meta.h1 || ""),
      post_title: stripHtmlTags(meta.post_title || ""),
      name: stripHtmlTags(meta.name || ""),
      meta_title: stripHtmlTags(meta.meta_title || ""),
      meta_description: stripHtmlTags(meta.meta_description || ""),
      image_url: stripHtmlTags(meta.image_url || extractImageFromContent(body)),
      published_at: stripHtmlTags(meta.published_at || ""),
      slug: stripHtmlTags(meta.slug || fallbackSlug),
    },
    body: removeLeadingH1(body),
  };
}

async function fetchPost(slug) {
  const candidates = [`./content/${slug}.md`, `./content/${slug}.json`, `./content/${slug}.txt`, `./content/${slug}.html`];
  for (const path of candidates) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) continue;

    if (path.endsWith(".json")) {
      const data = await response.json();
      const rawContent = data.content_markdown || data.content || "";
      return {
        meta: {
          title: stripHtmlTags(data.title || ""),
          h1: stripHtmlTags(data.h1 || ""),
          post_title: stripHtmlTags(data.post_title || ""),
          name: stripHtmlTags(data.name || ""),
          meta_title: stripHtmlTags(data.meta_title || ""),
          meta_description: stripHtmlTags(data.meta_description || ""),
          image_url: stripHtmlTags(data.image_url || extractImageFromContent(rawContent)),
          published_at: stripHtmlTags(data.published_at || ""),
          slug,
        },
        body: removeLeadingH1(rawContent),
      };
    }

    if (path.endsWith(".html")) {
      const rawHtml = await response.text();
      const extracted = extractFromRenderedHtml(rawHtml, slug);
      if (extracted) return extracted;
      continue;
    }

    const rawText = await response.text();
    return extractMarkdownDocument(rawText, slug);
  }
  throw new Error("Post not found");
}

async function loadPost() {
  const slug = getSlug();
  const titleEl = document.getElementById("post-title");
  const imageEl = document.getElementById("post-hero-image");
  const contentEl = document.getElementById("post-content");
  const metaEl = document.getElementById("post-meta");
  const readingTimeEl = document.getElementById("reading-time");
  const footerYear = document.getElementById("footer-year");
  const errorEl = document.getElementById("post-error");

  if (footerYear) footerYear.textContent = String(new Date().getFullYear());

  try {
    if (!slug) throw new Error("Missing slug");
    const post = await fetchPost(slug);
    const resolvedTitle = normalizeTitle(post.meta, slug, post.body);
    const resolvedImage = resolveImageUrl(post.meta.image_url || extractImageFromContent(post.body_html || post.body), `${slug}|${resolvedTitle}`);

    marked.setOptions({ gfm: true, breaks: false });
    const renderedHtml = post.body_html
      ? DOMPurify.sanitize(post.body_html)
      : DOMPurify.sanitize(marked.parse(post.body || ""));

    document.title = `${resolvedTitle} | TaxCryptoGuide`;
    titleEl.textContent = resolvedTitle;
    if (imageEl) {
      imageEl.src = resolvedImage;
      imageEl.alt = resolvedTitle;
      imageEl.classList.remove("hidden");
    }

    contentEl.innerHTML = renderedHtml;
    styleRenderedContent(contentEl, resolvedTitle);
    metaEl.textContent = post.meta.published_at
      ? `Published: ${new Date(post.meta.published_at).toLocaleDateString("en-US")}`
      : `Article: ${slug}`;
    if (readingTimeEl) readingTimeEl.textContent = estimateReadingTime(post.body || post.body_html || "");

    const fallbackDescription = stripHtmlTags(post.body || "").slice(0, 155) || "Crypto tax guide with practical automation insights.";
    const resolvedDescription = stripHtmlTags(post.meta.meta_description || fallbackDescription);
    applySeo(post.meta, resolvedTitle, resolvedDescription, slug);
  } catch {
    errorEl.textContent = "This article could not be loaded.";
    errorEl.classList.remove("hidden");
  }
}

loadPost();
