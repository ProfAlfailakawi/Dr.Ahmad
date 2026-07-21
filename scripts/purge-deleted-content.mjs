#!/usr/bin/env node
/**
 * ماحي المحذوف — «أيّ شيء أحذفه يُحذف من كل مكان».
 *
 * مصدر الحقيقة هو قرار اللوحة (`content_overrides.deleted === true`).
 * الإخفاء ليس حذفاً، لذلك لا يُمسّ المحتوى المخفي. أمّا المحذوف فيُنظَّف من
 * ملفات البيانات والمتون والصوت والروابط المشتقة والصفحات الساكنة والبطاقات
 * الاجتماعية، مع فحص سلامة الملفات قبل كتابة أي حرف.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");
const APPLY = process.argv.includes("--apply");

const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const slugCount = (source) => (source.match(/\bslug:\s*'/g) || []).length;

/** حذف كتلة مدخل TypeScript كاملةً، ولو امتدت إلى أسطر كثيرة. */
export function dropEntryBlocks(source, slugs) {
  let lines = source.split("\n");
  const removed = [];
  for (const slug of slugs) {
    const pattern = new RegExp(`slug:\\s*'${escape(slug)}'`);
    for (;;) {
      const at = lines.findIndex((line) => pattern.test(line));
      if (at === -1) break;
      let start = at;
      while (start >= 0 && !lines[start].includes("{")) start -= 1;
      if (start < 0) break;
      let depth = 0;
      let end = start;
      let closed = false;
      for (; end < lines.length; end += 1) {
        for (const ch of lines[end]) {
          if (ch === "{") depth += 1;
          else if (ch === "}") depth -= 1;
        }
        if (depth <= 0) {
          closed = true;
          break;
        }
      }
      if (!closed) break;
      lines = [...lines.slice(0, start), ...lines.slice(end + 1)];
      removed.push(slug);
    }
  }
  return { text: lines.join("\n"), removed };
}

/** حذف بطاقة ظهور إعلامي من src/data.ts عبر معرّف الرابط. */
export function dropMediaBlocks(source, slugs) {
  let lines = source.split("\n");
  const removed = [];
  for (const slug of slugs) {
    const token = String(slug).replace(/^media-/, "");
    if (!token) continue;
    const at = lines.findIndex(
      (line) =>
        (line.includes("youtube.com") || line.includes("youtu.be")) &&
        line.includes(token),
    );
    if (at === -1) continue;
    let start = at;
    while (start >= 0 && !lines[start].includes("{")) start -= 1;
    if (start < 0) continue;
    let depth = 0;
    let end = start;
    let closed = false;
    for (; end < lines.length; end += 1) {
      for (const ch of lines[end]) {
        if (ch === "{") depth += 1;
        else if (ch === "}") depth -= 1;
      }
      if (depth <= 0) {
        closed = true;
        break;
      }
    }
    if (!closed) continue;
    lines = [...lines.slice(0, start), ...lines.slice(end + 1)];
    removed.push(slug);
  }
  return { text: lines.join("\n"), removed };
}

/** توازن الأقواس؛ شرط سلامة قبل الكتابة. */
export function braceBalance(source) {
  let depth = 0;
  for (const ch of source) {
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  return depth;
}

/** حذف مفتاح من خريطة TypeScript من شكل `'slug': 'value'`. */
export function dropMapKeys(source, keys) {
  let lines = source.split("\n");
  const removed = [];
  for (const key of keys) {
    const at = lines.findIndex((line) =>
      new RegExp(`^\\s*'${escape(key)}'\\s*:`).test(line),
    );
    if (at === -1) continue;
    let end = at;
    while (end < lines.length && !/,\s*$/.test(lines[end])) end += 1;
    if (end >= lines.length) break;
    lines = [...lines.slice(0, at), ...lines.slice(end + 1)];
    removed.push(key);
  }
  return { text: lines.join("\n"), removed };
}

/** استخراج عناوين المواد قبل محوها لتنظيف التقارير التي تحفظ العنوان بلا slug. */
export function titlesForSlugs(source, slugs) {
  const titles = [];
  for (const slug of slugs) {
    const marker = `slug: '${slug}'`;
    let offset = 0;
    while (offset < source.length) {
      const at = source.indexOf(marker, offset);
      if (at < 0) break;
      const start = source.lastIndexOf("{", at);
      if (start < 0) break;
      let depth = 0;
      let end = start;
      for (; end < source.length; end += 1) {
        if (source[end] === "{") depth += 1;
        else if (source[end] === "}") depth -= 1;
        if (depth === 0) break;
      }
      const block = source.slice(start, end + 1);
      const title = block.match(/\btitle:\s*'([^']+)'/)?.[1]?.trim();
      if (title) titles.push(title);
      offset = Math.max(end + 1, at + marker.length);
    }
  }
  return [...new Set(titles)];
}

/** التحقق الصارم من قصّ كتل slug في ملف TypeScript. */
export function validateSlugMutation(label, source, text, removedCount) {
  const before = slugCount(source);
  const after = slugCount(text);
  const expected = before - removedCount;
  const balanced = braceBalance(text) === braceBalance(source);
  const counted = after === expected;
  return {
    ok: balanced && counted,
    message: `${label}: الأقواس ${braceBalance(source)} ← ${braceBalance(text)}، المدخلات ${before} ← ${after} (المتوقّع ${expected})`,
  };
}

/** حذف مفاتيح خرائط JSON المطابقة للمقالات المحذوفة. */
export function dropJsonKeys(
  value,
  keys,
  keyMatcher = (key, slug) => key === slug,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value, removed: 0 };
  }
  const out = { ...value };
  let removed = 0;
  for (const key of Object.keys(out)) {
    if (keys.some((slug) => keyMatcher(key, slug))) {
      delete out[key];
      removed += 1;
    }
  }
  return { value: out, removed };
}

/** تنقية المراجع العامة للمقالات من بنية JSON متداخلة. */
export function pruneArticleReferences(value, articleSlugs) {
  const set = new Set(articleSlugs);
  const directMatch = (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    for (const key of ["slug", "articleSlug", "sourceSlug", "contentSlug"]) {
      if (typeof item[key] === "string" && set.has(item[key])) return true;
    }
    for (const key of ["url", "href", "path", "src", "audio"]) {
      const raw = typeof item[key] === "string" ? item[key] : "";
      if (
        articleSlugs.some(
          (slug) =>
            raw.includes(`/articles/${slug}`) ||
            basename(raw).startsWith(`${slug}.`) ||
            basename(raw).startsWith(`${slug}-`),
        )
      )
        return true;
    }
    return false;
  };

  let removed = 0;
  const visit = (node) => {
    if (Array.isArray(node)) {
      const next = [];
      for (const item of node) {
        if (directMatch(item)) {
          removed += 1;
          continue;
        }
        next.push(visit(item));
      }
      return next;
    }
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node).map(([key, child]) => [key, visit(child)]),
      );
    }
    return node;
  };

  return { value: visit(value), removed };
}

/** هل المستند الآلي مشتق من مادة حُذفت نهائياً؟ */
export function generatedDocMatchesDeleted(
  data,
  { articleSlugs = [], bookSlugs = [], mediaSlugs = [], titles = [] } = {},
) {
  if (!data || typeof data !== "object") return false;
  const sourceKey = String(data.sourceKey || "");
  const sourcePath = String(data.sourcePath || data.url || "");
  const sourceTitle = String(data.sourceTitle || data.title || "").trim();

  if (articleSlugs.some((slug) => sourceKey === `article:${slug}`)) return true;
  if (bookSlugs.some((slug) => sourceKey === `book:${slug}`)) return true;
  if (
    articleSlugs.some(
      (slug) =>
        sourcePath === `/articles/${slug}` ||
        sourcePath.includes(`/articles/${slug}?`) ||
        sourcePath.includes(`/articles/${slug}#`),
    )
  )
    return true;
  if (
    bookSlugs.some(
      (slug) =>
        sourcePath === `/publications/${slug}` ||
        sourcePath.includes(`/publications/${slug}?`) ||
        sourcePath.includes(`/publications/${slug}#`),
    )
  )
    return true;
  if (
    mediaSlugs.some((slug) => {
      const token = String(slug).replace(/^media-/, "");
      return Boolean(token) && sourcePath.includes(token);
    })
  )
    return true;
  return Boolean(sourceTitle) && titles.includes(sourceTitle);
}

/* ═══ الاختبارات ═══ */
if (SELF_TEST) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`✘ ${message}`);
  };
  let pass = 0;
  const test = (message, condition) => {
    assert(condition, message);
    pass += 1;
  };

  const fixture = [
    "export const essays = [",
    "  { slug: 'dead-one', quote: 'يذهب معه' },",
    "]",
    "export const articles = [",
    "  { slug: 'alive-one', title: 'باقٍ' },",
    "  { slug: 'dead-one', title: 'محذوف', excerpt:",
    "      'نص على سطر ثانٍ' },",
    "  { slug: 'alive-two', meta: { year: 2020 } },",
    "]",
  ].join("\n");
  const dropped = dropEntryBlocks(fixture, ["dead-one"]);
  test("تُحذف الكتلة الممتدة كاملة", !dropped.text.includes("dead-one"));
  test("تُحذف كل نسخ المدخل", dropped.removed.length === 2);
  test(
    "يبقى المحتوى الحي",
    dropped.text.includes("alive-one") && dropped.text.includes("alive-two"),
  );
  test(
    "تبقى الأقواس متوازنة",
    braceBalance(dropped.text) === braceBalance(fixture),
  );
  test(
    "لا يُمسّ slug غير موجود",
    dropEntryBlocks(fixture, ["ghost"]).text === fixture,
  );

  const mutation = validateSlugMutation(
    "fixture",
    fixture,
    dropped.text,
    dropped.removed.length,
  );
  test("فاحص القصّ يقبل التعديل الصحيح", mutation.ok);
  test(
    "فاحص القصّ يرفض عدداً غير صحيح",
    !validateSlugMutation("fixture", fixture, dropped.text, 1).ok,
  );

  const map = [
    "export const titlesEn = {",
    "  'keep': 'Kept',",
    "  'drop':",
    "    'Wrapped value',",
    "  'keep2': 'Also kept',",
    "}",
  ].join("\n");
  const mapOut = dropMapKeys(map, ["drop"]);
  test(
    "يُحذف مفتاح الخريطة وقيمته الملتفة",
    !mapOut.text.includes("Wrapped value"),
  );
  test("تبقى مفاتيح الخريطة الحية", mapOut.text.includes("keep2"));

  const media = [
    "export const media = [",
    "  { title: 'يبقى', url: 'https://youtu.be/keep123' },",
    "  { title: 'يُحذف', url: 'https://www.youtube.com/watch?v=gone456' },",
    "]",
  ].join("\n");
  const mediaOut = dropMediaBlocks(media, ["media-gone456"]);
  test("يُحذف الظهور الإعلامي من الأصل", !mediaOut.text.includes("gone456"));
  test("يبقى الظهور الإعلامي الحي", mediaOut.text.includes("keep123"));
  test(
    "يُستخرج عنوان المحذوف لتنظيف التقارير",
    titlesForSlugs(fixture, ["dead-one"])[0] === "محذوف",
  );

  const keyed = dropJsonKeys(
    { keep: true, "dead.mp3": {}, "dead.noura.mp3": {} },
    ["dead"],
    (key, slug) => key === slug || key.startsWith(`${slug}.`),
  );
  test(
    "تُحذف كل مشتقات الصوت للمقال",
    keyed.removed === 2 && "keep" in keyed.value,
  );

  const nested = pruneArticleReferences(
    {
      episodes: [
        { slug: "keep", title: "حي" },
        { articleSlug: "dead", title: "محذوف" },
      ],
      books: [{ relatedPublicArticles: [{ slug: "dead" }, { slug: "keep" }] }],
    },
    ["dead"],
  );
  test("تُحذف المراجع المتداخلة للمقال", nested.removed === 2);
  test(
    "تبقى المراجع الحية المتداخلة",
    JSON.stringify(nested.value).includes("keep"),
  );
  test(
    "يُكتشف المستند الآلي المرتبط بمقال محذوف",
    generatedDocMatchesDeleted(
      { sourceKey: "article:dead", sourcePath: "/articles/dead" },
      { articleSlugs: ["dead"] },
    ),
  );
  test(
    "يبقى المستند الآلي المرتبط بمادة حية",
    !generatedDocMatchesDeleted(
      { sourceKey: "article:keep", sourceTitle: "حي" },
      { articleSlugs: ["dead"], titles: ["محذوف"] },
    ),
  );

  console.log(`✓ اختبارات ماحي المحذوف: ${pass}/${pass}`);
  process.exit(0);
}

/* ═══ التشغيل ═══ */
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || "sa.json");
if (!existsSync(saPath)) {
  console.log("⚠ لا sa.json — لا يمكن قراءة قرارات اللوحة. تخطّي.");
  process.exit(0);
}

const { initializeApp, cert, getApps } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const app =
  getApps()[0] ||
  initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, "utf8"))) });
const db = getFirestore(app);
const snapshot = await db.collection("content_overrides").get();

const articleSlugs = [];
const bookSlugs = [];
const paperSlugs = [];
const mediaSlugs = [];
snapshot.forEach((document) => {
  const data = document.data();
  if (data?.deleted !== true) return;
  const [kind, ...rest] = document.id.split(":");
  const slug = rest.join(":");
  if (!slug) return;
  if (kind === "article") articleSlugs.push(slug);
  else if (kind === "book") bookSlugs.push(slug);
  else if (kind === "paper") paperSlugs.push(slug);
  else if (kind === "media") mediaSlugs.push(slug);
});

console.log(
  `═══ ماحي المحذوف · ${articleSlugs.length} مقالاً · ${bookSlugs.length} كتاباً · ${paperSlugs.length} ورقة · ${mediaSlugs.length} ظهوراً إعلامياً ═══\n`,
);

const actions = [];
const writes = [];
const removals = new Set();
const queueWrite = (relative, value, count) => {
  if (!count) return;
  actions.push([relative, count]);
  writes.push([resolve(ROOT, relative), value]);
};

/* ١) المصدر الرئيسي: المقالات والكتب والظهور الإعلامي */
const dataPath = resolve(ROOT, "src/data.ts");
const dataSource = readFileSync(dataPath, "utf8");
const deletedTitles = new Set(
  titlesForSlugs(dataSource, [...articleSlugs, ...bookSlugs]),
);
const articleOut = dropEntryBlocks(dataSource, articleSlugs);
const bookOut = dropEntryBlocks(articleOut.text, bookSlugs);
const mediaOut = dropMediaBlocks(bookOut.text, mediaSlugs);
const dataText = mediaOut.text;
const dataRemoved =
  articleOut.removed.length + bookOut.removed.length + mediaOut.removed.length;
queueWrite("src/data.ts", dataText, dataRemoved);

/* النسخة الجذرية القديمة ما زالت تستخدمها بعض المهام الآلية؛ تنظيفها يمنع
   مادة محذوفة من العودة عبر مجدول أو تقرير قديم حتى لو كانت الواجهة نظيفة. */
let legacyDataMutation = null;
const legacyDataRelative = "data.ts";
const legacyDataPath = resolve(ROOT, legacyDataRelative);
if (existsSync(legacyDataPath)) {
  const source = readFileSync(legacyDataPath, "utf8");
  for (const title of titlesForSlugs(source, [...articleSlugs, ...bookSlugs]))
    deletedTitles.add(title);
  const articles = dropEntryBlocks(source, articleSlugs);
  const books = dropEntryBlocks(articles.text, bookSlugs);
  const media = dropMediaBlocks(books.text, mediaSlugs);
  const text = media.text;
  const removed =
    articles.removed.length + books.removed.length + media.removed.length;
  legacyDataMutation = { source, text, articles, books, media };
  queueWrite(legacyDataRelative, text, removed);
}

/* ٢) الأبحاث */
const papersPath = resolve(ROOT, "src/data/research-papers.ts");
const papersSource = readFileSync(papersPath, "utf8");
for (const title of titlesForSlugs(papersSource, paperSlugs))
  deletedTitles.add(title);
const papersOut = dropEntryBlocks(papersSource, paperSlugs);
queueWrite(
  "src/data/research-papers.ts",
  papersOut.text,
  papersOut.removed.length,
);

/* ٣) المرآة الإنجليزية */
const enPath = resolve(ROOT, "src/data-en.ts");
let enSource = "";
let enOut = { text: "", removed: [] };
if (existsSync(enPath)) {
  enSource = readFileSync(enPath, "utf8");
  enOut = dropMapKeys(enSource, [...articleSlugs, ...paperSlugs]);
  queueWrite("src/data-en.ts", enOut.text, enOut.removed.length);
}

/* ٤) خرائط JSON المباشرة: المتون، الصوت وبياناته */
for (const file of [
  "src/data/bodies.json",
  "src/data/bodies-vocalized.json",
  "src/data/audio.json",
]) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;
  const source = JSON.parse(readFileSync(path, "utf8"));
  const out = dropJsonKeys(source, articleSlugs);
  queueWrite(file, jsonText(out.value), out.removed);
}

const audioMetaFile = "src/data/audio-meta.json";
const audioMetaPath = resolve(ROOT, audioMetaFile);
if (existsSync(audioMetaPath)) {
  const source = JSON.parse(readFileSync(audioMetaPath, "utf8"));
  const out = dropJsonKeys(
    source,
    articleSlugs,
    (key, slug) =>
      key === slug ||
      key.startsWith(`${slug}.`) ||
      key.startsWith(`${slug}-`) ||
      key.startsWith(`${slug}_`),
  );
  queueWrite(audioMetaFile, jsonText(out.value), out.removed);
}

/* ٥) الروابط واللوحات المشتقة التي قد تعيد عنواناً محذوفاً */
for (const file of [
  "src/data/private-book-links.json",
  "src/data/site-articles-feed.json",
  "src/data/podcast-admin.json",
]) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) continue;
  const source = JSON.parse(readFileSync(path, "utf8"));
  const out = pruneArticleReferences(source, articleSlugs);
  queueWrite(file, jsonText(out.value), out.removed);
}

/* التقارير الداخلية قد تحفظ عنوان المادة حتى بعد اختفاء slug من المصدر. */
const deletedTokens = [
  ...articleSlugs,
  ...bookSlugs,
  ...paperSlugs,
  ...mediaSlugs,
  ...deletedTitles,
].filter(Boolean);
const reportsDir = resolve(ROOT, "reports");
if (existsSync(reportsDir) && statSync(reportsDir).isDirectory()) {
  for (const name of readdirSync(reportsDir)) {
    if (!name.endsWith(".md")) continue;
    const relative = `reports/${name}`;
    const path = resolve(ROOT, relative);
    const lines = readFileSync(path, "utf8").split("\n");
    const kept = lines.filter(
      (line) => !deletedTokens.some((token) => token && line.includes(token)),
    );
    const removed = lines.length - kept.length;
    queueWrite(relative, kept.join("\n"), removed);
  }
}

/* المستندات الآلية قد تحفظ مادة حُذفت في Firestore بعد تنظيف الملفات المحلية. */
const remoteDeletes = [];
for (const collectionName of ["site_inbox", "site_faqs", "site_picks"]) {
  const generated = await db.collection(collectionName).get();
  for (const document of generated.docs) {
    if (
      generatedDocMatchesDeleted(document.data(), {
        articleSlugs,
        bookSlugs,
        mediaSlugs,
        titles: [...deletedTitles],
      })
    )
      remoteDeletes.push(document.ref);
  }
}
if (remoteDeletes.length)
  actions.push(["مستندات آلية مشتقة في Firestore", remoteDeletes.length]);

/* ٦) الملفات والصفحات المتولدة أو القديمة */
const addIfExists = (relative) => {
  const absolute = resolve(ROOT, relative);
  if (existsSync(absolute)) removals.add(relative);
};

for (const slug of articleSlugs) {
  for (const prefix of ["", "dist/"]) {
    for (const rel of [
      `articles/${slug}.html`,
      `articles/${slug}/index.html`,
      `og/articles/${slug}.svg`,
      `og/articles/${slug}.png`,
    ])
      addIfExists(`${prefix}${rel}`);
  }
  for (const rel of [
    `public/og/articles/${slug}.svg`,
    `public/og/articles/${slug}.png`,
    `manual-dialogues/${slug}.json`,
    `podcast-audits/dialogues/${slug}.txt`,
  ])
    addIfExists(rel);
}

for (const slug of bookSlugs) {
  for (const prefix of ["", "dist/"]) {
    for (const rel of [
      `publications/${slug}.html`,
      `publications/${slug}/index.html`,
      `og/publications/${slug}.svg`,
      `og/publications/${slug}.png`,
    ])
      addIfExists(`${prefix}${rel}`);
  }
}

for (const slug of paperSlugs) {
  for (const prefix of ["", "dist/"]) {
    for (const rel of [
      `research/${slug}.html`,
      `research/${slug}/index.html`,
      `og/research/${slug}.svg`,
      `og/research/${slug}.png`,
    ])
      addIfExists(`${prefix}${rel}`);
  }
}

/* ملفات الصوت قد تحمل لاحقة صوت أو صيغة متعددة؛ نمسح ما يبدأ بالـslug فقط. */
const audioDirs = ["audio", "public/audio", "dist/audio"];
for (const dirRel of audioDirs) {
  const dir = resolve(ROOT, dirRel);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir)) {
    if (
      articleSlugs.some(
        (slug) =>
          name === slug ||
          name.startsWith(`${slug}.`) ||
          name.startsWith(`${slug}-`) ||
          name.startsWith(`${slug}_`),
      )
    )
      removals.add(`${dirRel}/${name}`);
  }
}

if (removals.size) actions.push(["ملفات قديمة/متولدة", removals.size]);
for (const [label, count] of actions)
  console.log(`  · ${String(label).padEnd(38)} ${count}`);
if (!actions.length) console.log("  ✓ لا أثر للمحذوف في أي مصدر — نظيف.");

if (!APPLY) {
  console.log("\nⓘ تشغيلة جافّة. أضف --apply للمحو.");
  process.exit(0);
}

/* ٧) فحص السلامة قبل أي كتابة */
const dataValidation = validateSlugMutation(
  "src/data.ts",
  dataSource,
  dataText,
  articleOut.removed.length + bookOut.removed.length,
);
if (!dataValidation.ok || braceBalance(dataText) !== braceBalance(dataSource)) {
  console.error(
    `\n✘ انكسر src/data.ts تحت المحو — لم يُكتب شيء.\n  ${dataValidation.message}`,
  );
  process.exit(1);
}
for (const slug of mediaOut.removed) {
  const token = String(slug).replace(/^media-/, "");
  if (token && dataText.includes(token)) {
    console.error(
      `\n✘ بقي ظهور إعلامي محذوف (${slug}) في src/data.ts — لم يُكتب شيء.`,
    );
    process.exit(1);
  }
}

if (legacyDataMutation) {
  const removedSlugBlocks =
    legacyDataMutation.articles.removed.length +
    legacyDataMutation.books.removed.length;
  const validation = validateSlugMutation(
    legacyDataRelative,
    legacyDataMutation.source,
    legacyDataMutation.text,
    removedSlugBlocks,
  );
  if (!validation.ok) {
    console.error(
      `\n✘ انكسرت النسخة الجذرية data.ts تحت المحو — لم يُكتب شيء.\n  ${validation.message}`,
    );
    process.exit(1);
  }
  for (const slug of legacyDataMutation.media.removed) {
    const token = String(slug).replace(/^media-/, "");
    if (token && legacyDataMutation.text.includes(token)) {
      console.error(
        `\n✘ بقي ظهور إعلامي محذوف (${slug}) في data.ts — لم يُكتب شيء.`,
      );
      process.exit(1);
    }
  }
}

const papersValidation = validateSlugMutation(
  "src/data/research-papers.ts",
  papersSource,
  papersOut.text,
  papersOut.removed.length,
);
if (!papersValidation.ok) {
  console.error(
    `\n✘ انكسر ملف الأبحاث تحت المحو — لم يُكتب شيء.\n  ${papersValidation.message}`,
  );
  process.exit(1);
}
if (
  enOut.removed.length &&
  braceBalance(enOut.text) !== braceBalance(enSource)
) {
  console.error("\n✘ انكسرت خريطة العناوين الإنجليزية — لم يُكتب شيء.");
  process.exit(1);
}

/* ٨) الكتابة والمحو بعد نجاح كل الفحوص */
for (const [path, text] of writes) writeFileSync(path, text);
for (const relative of removals)
  rmSync(resolve(ROOT, relative), { force: true, recursive: true });
for (let start = 0; start < remoteDeletes.length; start += 450) {
  const batch = db.batch();
  for (const ref of remoteDeletes.slice(start, start + 450)) batch.delete(ref);
  await batch.commit();
}

/* تنظيف المجلدات الفارغة المعروفة بعد حذف صفحات التفاصيل. */
for (const [base, slugs] of [
  ["articles", articleSlugs],
  ["publications", bookSlugs],
  ["research", paperSlugs],
]) {
  for (const slug of slugs) {
    for (const prefix of ["", "dist/"]) {
      const dir = resolve(ROOT, `${prefix}${base}/${slug}`);
      if (existsSync(dir) && readdirSync(dir).length === 0)
        rmSync(dir, { recursive: true, force: true });
    }
  }
}

console.log(
  `\n✔ مُحي من ${writes.length} ملف بيانات و${removals.size} ملفاً قديماً/متولداً و${remoteDeletes.length} مستنداً آلياً. لا تعود المادة المحذوفة مع البناء التالي.`,
);
