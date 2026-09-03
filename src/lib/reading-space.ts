import type { ArticleRecord, MediaRecord } from "./cms";
import type { PersistentTrack } from "./persistent-audio";

export const READ_LAST_KEY = "read:last";
export const RECENT_KEY = "reader:recent:v1";
export const JOURNEY_KEY = "reader:journey:v1";
export const SAVED_KEY = "reader:saved:v1";
export const READ_KEY = "reader:read:v1";
export const QUOTES_KEY = "reader:quotes:v2";
export const AUDIO_LAST_KEY = "audio:last:v1";
export const MEDIA_SAVED_KEY = "media:watch-later:v1";
export const PROGRESS_PREFIX = "reader:progress:v2:";
export const SPACE_EVENT = "reader:space-changed";

type ArticleSeed = Pick<
  ArticleRecord,
  "slug" | "title" | "cat" | "excerpt" | "iso"
>;
export type StoredArticle = ArticleSeed & { at: number; firstAt?: number };
export type StoredQuote = {
  id?: string;
  slug: string;
  title: string;
  quote: string;
  paragraph?: number;
  savedAt?: number;
  url?: string;
  note?: string;
};
export type StoredAudio = {
  track: PersistentTrack;
  current: number;
  duration: number;
  updatedAt: number;
};

const inBrowser = () => typeof window !== "undefined";
const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const articleSlugFromPath = (path = "") => {
  const match = clean(path).match(/^\/articles\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

function readJson<T>(key: string, fallback: T): T {
  if (!inBrowser()) return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null");
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!inBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين قد يكون محجوباً */
  }
}

export function notifyReadingSpace() {
  if (!inBrowser()) return;
  window.dispatchEvent(new CustomEvent(SPACE_EVENT));
}

const seedOf = (article: ArticleSeed): ArticleSeed => ({
  slug: article.slug,
  title: article.title,
  cat: article.cat,
  excerpt: article.excerpt,
  iso: article.iso,
});

export function recordArticleVisit(article: ArticleSeed) {
  if (!inBrowser()) return;
  const now = Date.now();
  const item: StoredArticle = { ...seedOf(article), at: now };
  writeJson(READ_LAST_KEY, {
    slug: article.slug,
    title: article.title,
    at: now,
  });
  const recent = readJson<StoredArticle[]>(RECENT_KEY, []).filter(
    (entry) => entry?.slug && entry.slug !== article.slug,
  );
  writeJson(RECENT_KEY, [item, ...recent].slice(0, 24));
  /* البصمة المعرفية تحتاج الرحلة كاملةً لا آخر 24 زيارة فقط. تبقى محليةً
     في جهاز القارئ، وتخزّن كل مقال مرةً واحدة: firstAt يحفظ أول نجمة، وat
     يتجدد كي يبقى آخر ما عاد إليه القارئ هو «آخر نجمة» فعلاً. */
  const journey = readJson<StoredArticle[]>(JOURNEY_KEY, []).filter(
    (entry) => entry?.slug && entry.slug !== article.slug,
  );
  const previous = readJson<StoredArticle[]>(JOURNEY_KEY, []).find((entry) => entry?.slug === article.slug);
  const journeyItem: StoredArticle = { ...item, firstAt: Number(previous?.firstAt || previous?.at || now) };
  writeJson(JOURNEY_KEY, [...journey, journeyItem]
    .sort((left, right) => Number(left.firstAt || left.at) - Number(right.firstAt || right.at))
    .slice(-300));
  notifyReadingSpace();
}

export function readArticleJourney() {
  return readJson<StoredArticle[]>(JOURNEY_KEY, []).filter((item) => item?.slug);
}

export function savedArticles() {
  return readJson<StoredArticle[]>(SAVED_KEY, []).filter((item) => item?.slug);
}

export function isArticleSaved(slug: string) {
  return savedArticles().some((item) => item.slug === slug);
}

export function toggleSavedArticle(article: ArticleSeed) {
  const current = savedArticles();
  const exists = current.some((item) => item.slug === article.slug);
  const next = exists
    ? current.filter((item) => item.slug !== article.slug)
    : [{ ...seedOf(article), at: Date.now() }, ...current].slice(0, 120);
  writeJson(SAVED_KEY, next);
  notifyReadingSpace();
  return !exists;
}


export function savedMediaSlugs() {
  return readJson<unknown[]>(MEDIA_SAVED_KEY, [])
    .map((item) => typeof item === "string" ? item : clean((item as { slug?: unknown })?.slug))
    .filter((slug): slug is string => Boolean(slug));
}

export function isMediaSaved(slug: string) {
  return savedMediaSlugs().includes(slug);
}

export function toggleSavedMedia(slug: string) {
  const current = savedMediaSlugs();
  const exists = current.includes(slug);
  const next = exists
    ? current.filter((item) => item !== slug)
    : [slug, ...current.filter((item) => item !== slug)].slice(0, 60);
  writeJson(MEDIA_SAVED_KEY, next);
  notifyReadingSpace();
  return !exists;
}

export function storeLastAudio(
  track: PersistentTrack,
  current: number,
  duration: number,
) {
  if (!track?.id || !track?.src || !Number.isFinite(current)) return;
  writeJson(AUDIO_LAST_KEY, {
    track,
    current: Math.max(0, current),
    duration: Number.isFinite(duration) ? Math.max(0, duration) : 0,
    updatedAt: Date.now(),
  } satisfies StoredAudio);
  notifyReadingSpace();
}

export function readLastAudio() {
  const value = readJson<StoredAudio | null>(AUDIO_LAST_KEY, null);
  if (!value?.track?.src || !value.track.id || !Number.isFinite(value.current))
    return null;
  return value;
}

export function progressFor(slug: string) {
  const value = readJson<{ progress?: number; updatedAt?: number }>(
    `${PROGRESS_PREFIX}${slug}`,
    {},
  );
  return Math.min(1, Math.max(0, Number(value.progress || 0)));
}

export function readingSpaceSnapshot(articles: ArticleRecord[], media: MediaRecord[] = []) {
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const mediaBySlug = new Map(media.map((item) => [item.slug, item]));
  const normalize = (item: StoredArticle): StoredArticle | null => {
    const article = bySlug.get(clean(item?.slug));
    return article ? { ...seedOf(article), at: Number(item.at || 0) } : null;
  };

  const lastRaw = readJson<{ slug?: string; at?: number } | null>(
    READ_LAST_KEY,
    null,
  );
  const lastArticle = lastRaw?.slug ? bySlug.get(lastRaw.slug) : undefined;
  const last = lastArticle
    ? { ...seedOf(lastArticle), at: Number(lastRaw?.at || 0) }
    : null;
  const recent = readJson<StoredArticle[]>(RECENT_KEY, [])
    .map(normalize)
    .filter(Boolean) as StoredArticle[];
  const saved = readJson<StoredArticle[]>(SAVED_KEY, [])
    .map(normalize)
    .filter(Boolean) as StoredArticle[];
  const quotes = readJson<StoredQuote[]>(QUOTES_KEY, [])
    .filter((item) => item?.slug && item?.quote && bySlug.has(item.slug))
    .map((item) => ({
      ...item,
      title: bySlug.get(item.slug)?.title || item.title,
    }));
  const audioRaw = readLastAudio();
  const audioSlug = audioRaw ? articleSlugFromPath(audioRaw.track.path) : "";
  const audioArticle = audioSlug ? bySlug.get(audioSlug) : undefined;
  const audio = !audioRaw
    ? null
    : audioSlug && !audioArticle
      ? null
      : audioArticle
        ? {
            ...audioRaw,
            track: {
              ...audioRaw.track,
              title: audioArticle.title,
              path: `/articles/${audioArticle.slug}`,
            },
          }
        : audioRaw;
  const savedMedia = savedMediaSlugs()
    .map((slug) => mediaBySlug.get(slug))
    .filter((item): item is MediaRecord => Boolean(item));
  return { last, recent, saved, quotes, audio, savedMedia };
}

/**
 * ينظف ذاكرة الجهاز من أي مادة لم تعد منشورة. لا نثق بأي عنوان مخزّن قديماً؛
 * العنوان دائماً يعاد من المحتوى الحي. بذلك لا يعيد الكاش أو localStorage
 * عنواناً أو بطاقة حذفها الدكتور من الموقع.
 */
export function sanitizeReadingSpace(articles: ArticleRecord[], media: MediaRecord[] = []) {
  if (!inBrowser()) return;
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const snapshot = readingSpaceSnapshot(articles, media);
  const journey = readArticleJourney()
    .map((item) => {
      const article = bySlug.get(clean(item?.slug));
      return article ? { ...seedOf(article), at: Number(item.at || 0), firstAt: Number(item.firstAt || item.at || 0) } : null;
    })
    .filter(Boolean) as StoredArticle[];

  if (snapshot.last)
    writeJson(READ_LAST_KEY, {
      slug: snapshot.last.slug,
      title: snapshot.last.title,
      at: snapshot.last.at,
    });
  else
    try {
      window.localStorage.removeItem(READ_LAST_KEY);
    } catch {
      /* noop */
    }

  writeJson(RECENT_KEY, snapshot.recent);
  writeJson(SAVED_KEY, snapshot.saved);
  writeJson(QUOTES_KEY, snapshot.quotes);
  writeJson(JOURNEY_KEY, journey);
  writeJson(MEDIA_SAVED_KEY, snapshot.savedMedia.map((item) => item.slug));

  const storedAudio = readLastAudio();
  if (snapshot.audio) writeJson(AUDIO_LAST_KEY, snapshot.audio);
  else if (storedAudio) {
    try {
      window.localStorage.removeItem(AUDIO_LAST_KEY);
      window.localStorage.removeItem(`audio:pos:${storedAudio.track.id}`);
    } catch {
      /* noop */
    }
  }

  const pendingQuote = readJson<{ slug?: string } | null>(
    "reader:pending-quote:v1",
    null,
  );
  if (pendingQuote?.slug && !bySlug.has(pendingQuote.slug)) {
    try {
      window.localStorage.removeItem("reader:pending-quote:v1");
    } catch {
      /* noop */
    }
  }

  const read = readJson<unknown[]>(READ_KEY, []).filter(
    (slug): slug is string => typeof slug === "string" && bySlug.has(slug),
  );
  writeJson(READ_KEY, [...new Set(read)].slice(-400));

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;

    let stale = false;
    if (key.startsWith(PROGRESS_PREFIX)) {
      stale = !bySlug.has(key.slice(PROGRESS_PREFIX.length));
    } else if (key.startsWith("podcast:manual-dialogue:")) {
      stale = !bySlug.has(key.slice("podcast:manual-dialogue:".length));
    } else if (key.startsWith("podcast:pending-cloud:")) {
      stale = !bySlug.has(key.slice("podcast:pending-cloud:".length));
    } else if (key.startsWith("audio:pos:")) {
      const id = decodeURIComponent(key.slice("audio:pos:".length));
      const file =
        id.match(/(?:^|\/)audio\/([^/?#]+)\.mp3(?:[?#].*)?$/)?.[1] || "";
      const slug = file.replace(/\.(?:noura|fahed|dialogue)$/, "");
      stale = Boolean(slug) && !bySlug.has(slug);
    }

    if (stale) {
      try {
        window.localStorage.removeItem(key);
        index -= 1;
      } catch {
        /* noop */
      }
    }
  }

  try {
    const focusSlug = window.localStorage.getItem("podcast:focus-slug") || "";
    if (focusSlug && !bySlug.has(focusSlug))
      window.localStorage.removeItem("podcast:focus-slug");
  } catch {
    /* noop */
  }

  try {
    const journeyPath =
      window.sessionStorage.getItem("journey:last-path") || "";
    const journeySlug = articleSlugFromPath(journeyPath);
    if (journeySlug && !bySlug.has(journeySlug))
      window.sessionStorage.removeItem("journey:last-path");
  } catch {
    /* noop */
  }

  // تنظيف ذاكرة الفكرة من المراجع إلى مقالات أزيلت، مع إبقاء الاهتمامات السليمة.
  try {
    const memory = readJson<{
      version?: number;
      topics?: Record<string, { lastSlug?: string }>;
    }>("idea-memory:v1", { version: 1, topics: {} });
    const topics = Object.fromEntries(
      Object.entries(memory.topics || {}).filter(
        ([, value]) => !value?.lastSlug || bySlug.has(value.lastSlug),
      ),
    );
    writeJson("idea-memory:v1", { ...memory, version: 1, topics });
  } catch {
    /* noop */
  }

  notifyReadingSpace();
}
