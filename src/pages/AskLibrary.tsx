/**
 * «العقل الحي» — /ask
 * يسأل الزائر سؤالاً حقيقياً، فيعيد الموقع ترتيب أرشيف الدكتور فقط:
 * اقتباسات حرفية، خط زمني، أحدث موقف منشور، ومسار قراءة قابل للطباعة.
 */
import { trackUsage } from '../lib/usage-analytics'
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EASE, FadeUp, Page, PageHead } from "../components/ui";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { KnowledgeEntry } from '../components/KnowledgeEntry'
import { useCmsContent } from "../lib/content";
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from "../lib/cms";
import { useSeo } from "../components/seo";
import { loadArticleBodies } from "../lib/article-bodies";
import { categoryLabel } from "../lib/content-taxonomy";
import { bestBookConcept, bookKnowledgeAnchor, bookKnowledgeText } from '../lib/book-knowledge'
import { loadBookPassages, matchBookQuotes, searchBookPassages, type BookQuoteMatch } from '../lib/book-quotes'
import { SocialIcon } from '../components/icons'
import { BranchGrove, ComposeScene, type Branch } from '../components/ComposeScene'
import { buildKnowledgeGraph, graphNeighbors, graphSearch, type KnowledgeGraph, type KnowledgeKind } from '../lib/knowledge-graph'
import { buildSmartQueryPlan, scoreSmartFields, smartRoots } from '../lib/smart-search'
import { arabicCountPhrase, EVIDENCE_FORMS, SOURCE_AFTER_PREPOSITION_FORMS } from '../lib/arabic-count.ts'
import { saveAskLibraryMemory } from '../lib/ask-library-memory'

const tokenize = (value: string) => smartRoots(value)

/* ── الأغصان ──
   خريطة المعرفة تربيعيةٌ على عدد المواد، فتُبنى مرةً واحدة في الجلسة كلها
   وتُحفظ هنا: الصفحة الثانية التي تحتاجها تجدها جاهزة. */
let knowledgeGraphCache: KnowledgeGraph | null = null

/* عبارات المحرّك مكتوبةٌ بلسانه هو («امتداد بين نوعين من المحتوى») وهي لغة
   بناءٍ لا لغة قارئ. تُترجَم هنا عند العرض فقط — والمحرّك يبقى كما هو. */
const BRANCH_WHY_FOR_READER: Record<string, string> = {
  'تقاطع مباشر في العنوان': 'الفكرة نفسها، بعنوانٍ آخر',
  'محور معرفي مشترك': 'يلتقيان عند المحور نفسه',
  'امتداد بين نوعين من المحتوى': 'الفكرة تمتدّ هنا في بابٍ آخر',
}

const BRANCH_KIND_LABEL: Record<KnowledgeKind, string> = {
  article: 'مقال',
  book: 'كتاب',
  paper: 'بحث محكّم',
  media: 'لقاء',
  curated: 'مختارات',
  podcast: 'حلقة',
  audio: 'قراءة صوتية',
  social: 'منشور',
  concept: 'مفهوم',
}

type Hit = {
  slug: string;
  title: string;
  iso: string;
  cat?: string;
  excerpt?: string;
  para: string;
  score: number;
};
type TimelineItem = {
  slug: string;
  title: string;
  iso: string;
  cat?: string;
  excerpt?: string;
  score: number;
};
type Ref = {
  kind: "كتاب" | "بحث محكّم" | "لقاء";
  slug: string;
  title: string;
  href: string;
};
type AskArticle = ArticleRecord & { body?: string };
type Answer = {
  hits: Hit[];
  near: TimelineItem[];
  refs: Ref[];
  timeline: TimelineItem[];
  latest?: TimelineItem;
  earliest?: TimelineItem;
  tension?: string;
};

type TwinCitation = {
  index: number;
  slug: string;
  title: string;
  quote?: string;
  url?: string;
};
type AnswerMode = 'direct' | 'timeline' | 'connections'

type TwinAnswer = {
  answer: string;
  citations: TwinCitation[];
  grounded: boolean;
  source: "ai" | "local";
};

function matchRefs(
  question: string,
  books: BookRecord[],
  papers: PaperRecord[],
  media: MediaRecord[] = [],
): Ref[] {
  const plan = buildSmartQueryPlan(question)
  const refs: (Ref & { score: number })[] = []

  for (const book of books) {
    const concept = bestBookConcept(question, book.slug)
    const score = scoreSmartFields(plan, [
      { value: book.title, weight: 5.2, phraseWeight: 1.6, exactWeight: 1.7 },
      { value: book.desc || '', weight: 2.2 },
      { value: bookKnowledgeText(book.slug), weight: 1.3 },
    ]) + (concept?.score || 0) * .5
    if (score > 7) refs.push({
      kind: 'كتاب',
      slug: book.slug,
      title: concept && concept.score > 18 ? `${book.title} — ${concept.concept.title} (ص ${concept.concept.pageStart})` : book.title,
      href: concept && concept.score > 18 ? `/publications/${book.slug}#${bookKnowledgeAnchor(concept.concept)}` : `/publications/${book.slug}`,
      score,
    })
  }

  for (const paper of papers) {
    const title = paper.titleAr || paper.title
    const score = scoreSmartFields(plan, [
      { value: title, weight: 5, phraseWeight: 1.5, exactWeight: 1.6 },
      { value: paper.abstractAr || '', weight: 2.2 },
      { value: `${paper.meta || ''} ${paper.keywords || ''} ${paper.keyFinding || ''}`, weight: 1.5 },
    ])
    if (score > 7) refs.push({ kind: 'بحث محكّم', slug: paper.slug, title, href: `/research/${paper.slug}`, score })
  }

  for (const item of media) {
    const score = scoreSmartFields(plan, [
      { value: item.title, weight: 5, phraseWeight: 1.5, exactWeight: 1.6 },
      { value: `${item.topics || ''} ${item.program || ''} ${item.channel || ''} ${item.outlet || ''}`, weight: 1.8 },
      { value: item.transcript || '', weight: 1.05 },
    ])
    if (score > 7) refs.push({ kind: 'لقاء', slug: item.slug, title: item.title, href: `/media/${item.slug}`, score })
  }

  /* لا يبتلع نوعٌ واحد القائمة: نضمن حضور الأنواع المختلفة متى كانت ذات صلة،
     ثم نكمل بالأقوى دلالياً. */
  const sorted = refs.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ar'))
  const quota = new Map<Ref['kind'], number>()
  const balanced = sorted.filter((item) => {
    const used = quota.get(item.kind) || 0
    if (used >= 2) return false
    quota.set(item.kind, used + 1)
    return true
  })
  const rest = sorted.filter((item) => !balanced.includes(item))
  return [...balanced, ...rest].slice(0, 6)
}

function compactText(text = "", limit = 460) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const end = Math.max(
    cut.lastIndexOf("."),
    cut.lastIndexOf("؟"),
    cut.lastIndexOf("!"),
    cut.lastIndexOf("،"),
  );
  return (
    (end > 200 ? cut.slice(0, end + 1) : cut).trim() + (end > 200 ? "" : "…")
  );
}

function toTimelineItem(entry: { a: AskArticle; score: number }): TimelineItem {
  return {
    slug: entry.a.slug,
    title: entry.a.title,
    iso: entry.a.iso,
    cat: entry.a.cat,
    excerpt: entry.a.excerpt,
    score: entry.score,
  };
}

function answer(
  question: string,
  bodies: Record<string, string>,
  articles: ArticleRecord[],
  books: BookRecord[],
  papers: PaperRecord[],
  media: MediaRecord[] = [],
): Answer {
  const plan = buildSmartQueryPlan(question)
  const q = plan.directRoots.length ? plan.directRoots : tokenize(question)
  if (!q.length) return { hits: [], near: [], refs: [], timeline: [] };

  const scored = articles
    .map((article) => {
      const a: AskArticle = {
        ...article,
        body: bodies[article.slug] || undefined,
      };
      const score = scoreSmartFields(plan, [
        { value: a.title, weight: 5.2, phraseWeight: 1.6, exactWeight: 1.7 },
        { value: a.excerpt || '', weight: 2.8, phraseWeight: 1.2 },
        { value: a.body || '', weight: 1.15 },
        { value: a.cat || '', weight: 1.1 },
      ])
      return { a, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score || right.a.iso.localeCompare(left.a.iso),
    );

  const near = scored
    .slice(0, 4)
    .filter((item) => item.score > 7)
    .map(toTimelineItem);
  const relevant = scored.filter((item) => item.score >= 8).map(toTimelineItem);
  const chronological = [...relevant].sort((left, right) =>
    left.iso.localeCompare(right.iso),
  );
  const timeline = chronological
    .filter(
      (item, index, all) =>
        index === 0 ||
        index === all.length - 1 ||
        index % Math.max(1, Math.ceil(all.length / 4)) === 0,
    )
    .slice(0, 6);
  const earliest = chronological[0];
  const latest = [...relevant].sort((left, right) =>
    right.iso.localeCompare(left.iso),
  )[0];
  const cats = Array.from(
    new Set(relevant.map((item) => item.cat).filter(Boolean)),
  );
  const tension =
    cats.length > 1
      ? `هذا السؤال لا يظهر في باب واحد فقط؛ يمرّ بين ${cats
          .slice(0, 3)
          .map((cat) => `«${cat}»`)
          .join(
            " و",
          )}، وكأن الفكرة عند الدكتور ليست تكنولوجية أو تربوية وحدها، بل سؤال إنساني يتغير سياقه.`
      : undefined;
  const refs = matchRefs(question, books, papers, media);
  const top = scored.filter((item) => item.score >= 12).slice(0, 3);

  const hits: Hit[] = [];
  for (const { a } of top) {
    if (!a.body) continue;
    const paras = a.body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 60);
    let best = "";
    let bestScore = -1;
    for (const p of paras) {
      let score = scoreSmartFields(plan, [{ value: p, weight: 1.25, phraseWeight: 1.2 }]);
      if (p.length > 900) score -= 1;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (bestScore > 7)
      hits.push({
        slug: a.slug,
        title: a.title,
        iso: a.iso,
        cat: a.cat,
        excerpt: a.excerpt,
        para: compactText(best),
        score: bestScore,
      });
  }

  return { hits, near, refs, timeline, latest, earliest, tension };
}

function normalizeGroundedAnswerWording(value: string, citationCount: number) {
  const answer = value.trim()
  if (!answer || citationCount < 1) return answer
  const contradictory = /^(?:لم أجد|لم نجد|لا أجد|لا يوجد جواب|لا توجد إجابة|تعذّر العثور على جواب)/u
  if (!contradictory.test(answer)) return answer
  const cleaned = answer
    .replace(contradictory, '')
    .replace(/^[\s،,:؛.\-–—]+/u, '')
  const lead = 'هذه إجابة مركّبة من المواد والشواهد الموثّقة الأقرب إلى السؤال، لا من نص واحد يطابق صياغته حرفياً.'
  return cleaned ? `${lead} ${cleaned}` : lead
}

function localGroundedAnswer(result: Answer): TwinAnswer {
  const citations = result.hits.slice(0, 3).map((hit, index) => ({
    index: index + 1,
    slug: hit.slug,
    title: hit.title,
    quote: hit.para,
    url: `/articles/${hit.slug}`,
  }));
  if (!citations.length) {
    return {
      answer: "لم أجد في أرشيفي المنشور ما يكفي للإجابة عن هذا السؤال.",
      citations: [],
      grounded: false,
      source: "local",
    };
  }
  const years = result.hits.slice(0, 3).map((hit) => hit.iso.slice(0, 4));
  const span =
    years.length > 1 && new Set(years).size > 1
      ? ` ويتكرر الخيط في نصوص منشورة بين ${years[years.length - 1]} و${years[0]}.`
      : "";
  return {
    answer: `هذه إجابة مركّبة من أقرب المواد الموثّقة في الأرشيف؛ فالسؤال لا يقابله نص واحد بصياغته نفسها.${span} ${citations.map((item) => `[${item.index}]`).join(" ")}`.trim(),
    citations,
    grounded: true,
    source: "local",
  };
}


const arDigits = (value: number | string) => String(value)

const escapePrint = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function printPersonalBook(
  asked: string,
  chapters: { label: string; item: TimelineItem; note: string }[],
) {
  const printWindow = window.open(
    "",
    "personal-reading-book",
    "width=980,height=820",
  );
  if (!printWindow) return false;
  try {
    printWindow.opener = null;
  } catch {
    /* حماية إضافية من وصول النافذة إلى الأصل */
  }
  const date = new Date().toLocaleDateString("ar-KW-u-nu-arab", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const rows = chapters
    .map(
      ({ label, item, note }, index) => `
    <article class="chapter">
      <div class="number">${arDigits(String(index + 1).padStart(2, "0"))}</div>
      <div>
        <p class="meta">${escapePrint(label)} · ${escapePrint(arDigits(item.iso.slice(0, 4)))}</p>
        <h2>${escapePrint(item.title)}</h2>
        <p class="note">${escapePrint(note)}</p>
        <p class="url">dr-alfailakawi.com/articles/${encodeURIComponent(item.slug)}</p>
      </div>
    </article>`,
    )
    .join("");
  printWindow.document.open();
  printWindow.document
    .write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مسار قراءة — ${escapePrint(asked)}</title><style>
    @page{size:A4;margin:18mm 17mm 20mm}*{box-sizing:border-box}body{margin:0;color:#14202c;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.75}header{border-top:5px solid #365a7a;border-bottom:1px solid #dfe4e8;padding:20px 0 24px}header small{color:#987b38;font-weight:700}h1{font-size:27px;line-height:1.5;margin:10px 0 8px}.intro{font-size:14px;color:#66717d;margin:0}.question{margin:24px 0 0;border-right:3px solid #987b38;background:#f7f8f7;padding:14px 18px;font-size:18px;font-weight:700}.chapter{display:grid;grid-template-columns:42px 1fr;gap:15px;padding:20px 0;border-bottom:1px solid #e4e7e9;break-inside:avoid}.number{width:38px;height:38px;border:1px solid #cdd5db;border-radius:50%;display:grid;place-items:center;color:#365a7a;font-size:12px;font-weight:700}.meta{margin:0;color:#365a7a;font-size:12px;font-weight:700}.chapter h2{font-size:17px;line-height:1.65;margin:3px 0}.note{font-size:13px;color:#65717c;margin:2px 0}.url{direction:ltr;text-align:right;font-size:10px;color:#8a9299;margin:5px 0 0;overflow-wrap:anywhere}footer{display:flex;justify-content:space-between;gap:20px;margin-top:26px;padding-top:12px;border-top:1px solid #cfd6db;color:#6a737c;font-size:10px}.screen{position:fixed;left:18px;top:18px;border:0;border-radius:999px;background:#365a7a;color:white;padding:10px 18px;font-weight:700;cursor:pointer}@media print{.screen{display:none}}
  </style></head><body><button class="screen" onclick="window.print()">طباعة / حفظ PDF</button><header><small>تطور السؤال عبر الأرشيف</small><h1>مسار قراءة من المواد المنشورة فقط</h1><p class="intro">مسار زمني واضح يبدأ من السؤال، ويتتبع تطور الفكرة في المواد المنشورة.</p><div class="question">«${escapePrint(asked)}»</div></header><main>${rows}</main><footer><span>أُعدّ في ${escapePrint(date)}</span><span>الموقع الرسمي للدكتور أحمد حسين الفيلكاوي · dr-alfailakawi.com</span></footer><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));<\/script></body></html>`);
  printWindow.document.close();
  return true;
}

function buildPersonalBookChapters(result: Answer) {
  return [
    result.earliest && {
      label: "الفصل الأول",
      item: result.earliest,
      note: "أول موضع واضح في الأرشيف يلامس السؤال.",
    },
    ...result.timeline.slice(1, 4).map((item, index) => ({
      label: `الفصل ${index + 2}`,
      item,
      note: "محطة لاحقة تكشف كيف تحركت الفكرة.",
    })),
    result.latest && {
      label: "أحدث موقف",
      item: result.latest,
      note: "أقرب إجابة منشورة تمثل الموقف الآن.",
    },
  ]
    .filter(Boolean)
    .filter(
      (entry, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate && entry && candidate.item.slug === entry.item.slug,
        ) === index,
    ) as { label: string; item: TimelineItem; note: string }[];
}

export default function AskLibrary() {
  const reduce = useReducedMotion()
  const openedAtRef = useRef(performance.now())
  const completedRef = useRef(false)
  useEffect(() => {
    trackUsage('living_mind_opened', { entry: document.referrer && new URL(document.referrer).origin === location.origin ? 'internal' : 'direct' }, { onceKey: 'living-mind-opened' })
    return () => { if (!completedRef.current) trackUsage('living_mind_abandoned', { durationMs: Math.round(performance.now() - openedAtRef.current) }) }
  }, [])
  const { articles, books, papers, media } = useCmsContent();
  const [searchParams] = useSearchParams();
  const initialQuestion = (searchParams.get("q") || "").trim();
  useSeo({
    title: "العقل الحي",
    path: "/ask",
    description:
      "اسأل سؤالاً حقيقياً، فيبني الموقع إجابة موثقة من أرشيف د. أحمد حسين الفيلكاوي فقط: مقالات، تطور زمني، ومصادر.",
  });
  const [q, setQ] = useState(initialQuestion);
  const [asked, setAsked] = useState(
    initialQuestion.length >= 4 ? initialQuestion : "",
  );
  const [bodies, setBodies] = useState<Record<string, string> | null>(null);
  const [bodiesLoading, setBodiesLoading] = useState(false);
  const resRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const result = useMemo(
    () =>
      asked && bodies ? answer(asked, bodies, articles, books, papers, media) : null,
    [asked, articles, bodies, books, media, papers],
  );
  useEffect(() => {
    if (!result || completedRef.current) return
    completedRef.current = true
    trackUsage('living_mind_completed', { results: result.hits.length + result.refs.length, durationMs: Math.round(performance.now() - openedAtRef.current) })
  }, [result])
  /* ── من متن كتبه ──
     المختارات (214 مقطعاً) محمّلة مع الصفحة فتظهر النتيجة فوراً؛ ثم يُجلب
     فهرس المتون الكامل (939 مقطعاً من تسعة كتب) في الخلفية فترتقي النتيجة
     من «مختارات» إلى «الكتب كاملة» بلا انتظارٍ يراه الزائر. */
  const [passagesReady, setPassagesReady] = useState(false);
  useEffect(() => {
    if (!asked || passagesReady) return;
    let on = true;
    void loadBookPassages().then(() => { if (on) setPassagesReady(true); });
    return () => { on = false; };
  }, [asked, passagesReady]);

  const bookVoice: BookQuoteMatch[] = useMemo(() => {
    if (!asked) return [];
    const deep = passagesReady ? searchBookPassages(asked, 4) : [];
    return deep.length ? deep : matchBookQuotes(asked, 3);
  }, [asked, passagesReady]);

  /* ── الأغصان ──
     خريطة المعرفة تعيد الجارَ ومعه سببُ صلته. وبناؤها ثقيل، فلا يبدأ إلا بعد
     أن يرى الزائر جوابه، وفي لحظة خمولٍ لا في الخيط الحارّ. */
  const [grove, setGrove] = useState<Branch[]>([]);
  useEffect(() => {
    if (!asked || !result) { setGrove([]); return; }
    let on = true;
    const build = () => {
      if (!on) return;
      try {
        const graph = knowledgeGraphCache
          || (knowledgeGraphCache = buildKnowledgeGraph({ articles, books, papers, media }));
        const seed = graphSearch(graph, asked, 1)[0];
        if (!seed) { setGrove([]); return; }
        const near = graphNeighbors(graph, seed.node.id, 6);
        /* التنويع أولاً — كقانون «الفصل التالي»: ما اختلف نوعه يسبق. */
        const varied = near.filter((item) => item.node.kind !== seed.node.kind);
        const pool = varied.length ? varied : near;
        setGrove(pool.slice(0, 2).map(({ edge, node }) => ({
          id: node.id,
          kind: BRANCH_KIND_LABEL[node.kind] || 'مادة',
          title: node.title,
          why: BRANCH_WHY_FOR_READER[edge.reasons[0]] || 'قرابةٌ في الموضوع',
          to: node.url,
        })));
      } catch {
        /* بلا أغصان: الجواب ومصادره كما هي. لا يستحق إزعاج القارئ. */
        setGrove([]);
      }
    };
    /* لا تُقاطَع Window هنا: lib.dom تعرّف requestIdleCallback إلزامياً، فتصير
       القطعُ مع نسخةٍ اختيارية إلزاميةً فيسقط الحارس. وسفاري القديم لا يعرفها. */
    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    };
    const idle = win.requestIdleCallback;
    const cancelIdle = win.cancelIdleCallback;
    const handle = idle ? idle.call(window, build, { timeout: 2200 }) : window.setTimeout(build, 500);
    return () => {
      on = false;
      if (idle && cancelIdle) cancelIdle.call(window, handle);
      else window.clearTimeout(handle);
    };
  }, [articles, asked, books, media, papers, result]);

  const [twin, setTwin] = useState<TwinAnswer | null>(null);
  const [twinLoading, setTwinLoading] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>('direct');
  const [answerCopied, setAnswerCopied] = useState(false);
  const coverage = useMemo(() => {
    if (!result) return null;
    const evidence = result.hits.length + result.refs.length;
    return { label: evidence ? 'موثّق' : 'دون شواهد كافية', note: arabicCountPhrase(evidence, EVIDENCE_FORMS) };
  }, [result]);

  useEffect(() => {
    let active = true;
    if (!asked || bodies)
      return () => {
        active = false;
      };
    setBodiesLoading(true);
    loadArticleBodies()
      .then((map) => {
        if (active) setBodies(map);
      })
      .finally(() => {
        if (active) setBodiesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [asked, bodies]);

  useEffect(() => {
    const controller = new AbortController();
    if (!asked || !result || (!result.hits.length && !result.refs.length)) {
      setTwin(null);
      setTwinLoading(false);
      return () => controller.abort();
    }

    const fallback = localGroundedAnswer(result);
    setTwin(null);
    setTwinLoading(true);
    void fetch("/api/ai/archive-answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        question: asked,
        evidence: result.hits.slice(0, 8).map((hit) => ({
          slug: hit.slug,
          title: hit.title,
          year: hit.iso.slice(0, 4),
          quote: hit.para,
          url: `/articles/${hit.slug}`,
        })),
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`archive-answer:${response.status}`);
        const payload = (await response.json()) as Partial<TwinAnswer>;
        const citations = Array.isArray(payload.citations)
          ? payload.citations.filter((item): item is TwinCitation =>
              Boolean(
                item &&
                Number.isInteger(Number(item.index)) &&
                typeof item.slug === "string" &&
                typeof item.title === "string",
              ),
            )
          : [];
        if (
          typeof payload.answer !== "string" ||
          !payload.answer.trim() ||
          payload.grounded !== true ||
          !citations.length
        ) {
          setTwin(fallback);
          return;
        }
        setTwin({
          answer: normalizeGroundedAnswerWording(payload.answer, citations.length),
          citations,
          grounded: true,
          source: "ai",
        });
      })
      .catch((error) => {
        if ((error as Error)?.name !== "AbortError") setTwin(fallback);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTwinLoading(false);
      });

    return () => controller.abort();
  }, [asked, result]);

  const again = () => {
    setAsked("");
    setQ("");
    setTwin(null);
    setAnswerMode('direct');
    setAnswerCopied(false);
    setTimeout(() => inputRef.current?.focus(), 60);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ask = (text: string) => {
    trackUsage('living_mind_started', { queryLength: text.trim().length })
    const trimmed = text.trim();
    if (trimmed.length < 4) return;
    setQ(trimmed);
    setAsked(trimmed);
    setAnswerMode('direct');
    setAnswerCopied(false);
    setTimeout(
      () =>
        resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };

  const timelineAnswer = result?.earliest && result?.latest
    ? `يمتد الخيط من «${result.earliest.title}» سنة ${result.earliest.iso.slice(0, 4)} إلى «${result.latest.title}» سنة ${result.latest.iso.slice(0, 4)}، ويضع تحولات الفكرة المنشورة على خط زمني واحد.`
    : 'لا يكفي الأرشيف المتاح لبناء خط زمني موثوق لهذا السؤال.';
  const connectionsAnswer = result
    ? result.refs.length
      ? `يرتبط السؤال بـ${arabicCountPhrase(result.refs.length, SOURCE_AFTER_PREPOSITION_FORMS)} من الكتب والأبحاث؛ افتحها لتوسيع القراءة من زوايا متجاورة.`
      : 'لا يظهر في الأرشيف الآن كتاب أو بحث قريب بما يكفي من هذا السؤال.'
    : '';
  const visibleAnswer = answerMode === 'timeline' ? timelineAnswer : answerMode === 'connections' ? connectionsAnswer : twin?.answer || '';
  const memoryAnswer = twin?.answer || (result ? localGroundedAnswer(result).answer : '');
  useEffect(() => {
    if (!asked || !result || (!result.hits.length && !result.refs.length) || !memoryAnswer.trim()) return;
    saveAskLibraryMemory({
      question: asked,
      summary: memoryAnswer,
      branches: grove.map(({ id, kind, title, why, to }) => ({ id, kind, title, why, to })),
    });
  }, [asked, grove, memoryAnswer, result]);
  const personalBookChapters = result ? buildPersonalBookChapters(result) : [];
  const [printBlocked, setPrintBlocked] = useState(false);
  const handlePrintReadingRoute = () => {
    setPrintBlocked(false);
    if (!asked || !personalBookChapters.length) return;
    if (!printPersonalBook(asked, personalBookChapters)) setPrintBlocked(true);
  };
  const copyArchiveAnswer = async () => {
    if (!result || !visibleAnswer) return;
    const sources = [
      ...result.hits.map((item) => `- ${item.title}: /articles/${item.slug}`),
      ...result.refs.map((item) => `- ${item.title}: ${item.href}`),
    ].join('\n');
    const payload = `${asked}\n\n${visibleAnswer}\n\nالمصادر:\n${sources}`;
    try {
      await navigator.clipboard.writeText(payload);
      setAnswerCopied(true);
      window.setTimeout(() => setAnswerCopied(false), 1800);
    } catch { /* النسخ رفاهية ولا يعطّل الجواب */ }
  };

  return (
    <Page className="content-thought-paths page-journey">
      <PageHead
        label="العقل الحي"
        title="اسأل الأرشيف سؤالاً حقيقياً."
        sub="محادثة موثّقة مع الأرشيف: يركّب الجواب من مقالاتي وأبحاثي وكتبي فقط، ويعيدك إلى النص الحرفي الذي استند إليه. إن لم يجد دليلاً يقول ذلك بوضوح."
      />

      <div className="px-6 pt-8 md:px-11"><div className="mx-auto max-w-3xl"><KnowledgeEntry /></div></div>

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-3xl">
          <FadeUp>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(q)}
                placeholder="اكتب سؤالك هنا…"
                aria-label="سؤالك"
                className="min-h-12 flex-1 rounded-xl border border-hair bg-canvas px-5 py-3 text-[1rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <button
                onClick={() => ask(q)}
                className="min-h-12 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-colors hover:bg-accent-deep"
              >
                اسأل
              </button>
            </div>
          </FadeUp>

          <div ref={resRef} className="scroll-mt-28">
            {asked && bodiesLoading && (
              <FadeUp>
                <div className="mt-12 border-t border-hair pt-6">
                  <ComposeScene lines={["أرتّب مواد الأرشيف الأقرب إلى السؤال…"]} />
                </div>
              </FadeUp>
            )}
            {result && (
              <div className="mt-12">
                {result.hits.length > 0 || result.refs.length > 0 ? (
                  <>
                    <FadeUp>
                      <section
                        className="border-y border-hair py-7 md:py-9"
                        aria-live="polite"
                      >
                        <p className="text-[.75rem] font-medium text-soft">
                          الجواب
                        </p>
                        <h2 className="mt-2 font-display text-[1.16rem] font-semibold leading-relaxed text-ink">
                          خلاصة مرتبطة بمصادرها، لا رأي من خارج الأرشيف.
                        </h2>
                        <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label="عدسة الجواب">
                          {([
                            ['direct', 'الخلاصة'],
                            ['timeline', 'المسار'],
                            ['connections', 'امتدادات'],
                          ] as [AnswerMode, string][]).map(([id, label]) => (
                            <button key={id} type="button" role="tab" aria-selected={answerMode === id} onClick={() => setAnswerMode(id)} className={`min-h-11 rounded-xl border px-2 py-2 text-[.7rem] font-semibold transition ${answerMode === id ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>{label}</button>
                          ))}
                        </div>
                        {coverage && (
                          <div className="mt-4 flex flex-wrap items-center gap-2 text-[.68rem]">
                            <span className="rounded-full border border-accent/30 bg-accent/[.05] px-3 py-1 font-semibold text-accent">{coverage.label}</span>
                            <span className="text-soft">{coverage.note}</span>
                          </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                          {answerMode === 'direct' && twinLoading && !twin ? (
                            <motion.div
                              key="answer-loading"
                              initial={reduce ? false : { opacity: 0, y: 7 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={reduce ? undefined : { opacity: 0, y: -5 }}
                              transition={{ duration: reduce ? 0 : .28, ease: EASE }}
                              className="mt-5"
                            >
                              <ComposeScene compact lines={["أرتّب الشواهد الأقرب إلى سؤالك…"]} />
                            </motion.div>
                          ) : visibleAnswer ? (
                            <motion.div
                              key={answerMode}
                              initial={reduce ? false : { opacity: 0, y: 10, filter: 'blur(2px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={reduce ? undefined : { opacity: 0, y: -7, filter: 'blur(1.5px)' }}
                              transition={{ duration: reduce ? 0 : .34, ease: EASE }}
                            >
                              <p className="mt-5 whitespace-pre-line text-[.96rem] font-light leading-[2.05] text-ink/90">{visibleAnswer}</p>
                              {answerMode !== 'direct' && (
                                <p className="mt-4 text-[.68rem] leading-relaxed text-soft">رتّبت لك المواد الأقرب عبر الزمن لتتبع الفكرة خطوةً بعد خطوة.</p>
                              )}
                              <p className="mt-3 border-t border-hair pt-3 text-[.68rem] leading-relaxed text-soft/[.85]">
                                الإجابة مستندة إلى مواد منشورة وموثّقة. سؤالك خاص ولا يُنشر.
                              </p>
                              <div className="mt-5 flex flex-wrap gap-2">
                                <button type="button" onClick={() => { void copyArchiveAnswer(); trackUsage('living_mind_result_used', { type: 'copy_answer' }) }} aria-label="نسخ الجواب بمصادره" title={answerCopied ? 'نُسخ الجواب بمصادره' : 'نسخ الجواب بمصادره'} className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition hover:border-accent hover:text-accent ${answerCopied ? 'border-accent bg-accent text-white' : 'border-hair text-ink'}`}><SocialIcon name={answerCopied ? 'Check' : 'Copy'} size={17} /></button>
                                <Link to="/thought-paths" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-accent/[.35] px-5 text-[.76rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">استكشف المسار الفكري <span aria-hidden>←</span></Link>
                              </div>
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </section>
                    </FadeUp>

                    {/* الأغصان تنبت من الجواب نفسه، ويُكتب تحت كلٍّ سببُ صلته. */}
                    {grove.length > 0 && (
                      <div className="mt-1">
                        <BranchGrove
                          items={grove}
                          onOpen={(branch) => trackUsage('living_mind_result_used', { type: 'open_source', resultId: branch.id })}
                        />
                      </div>
                    )}

                    <section
                      className="mt-9"
                      aria-labelledby="archive-sources-title"
                    >
                      <p
                        id="archive-sources-title"
                        className="text-[.8rem] font-medium text-soft"
                      >
                        المصادر والشواهد
                      </p>
                      {twin?.citations.length ? (
                        <ol className="mt-4 grid gap-3 border-b border-hair pb-6">
                          {twin.citations.map((citation) => (
                            <li key={`${citation.index}-${citation.slug}`}>
                              <Link
                                to={citation.url || `/articles/${citation.slug}`} onClick={() => trackUsage('living_mind_result_used', { type: 'open_source', resultId: citation.slug })}
                                className="group flex gap-3 text-[.82rem] text-soft transition-colors hover:text-accent"
                              >
                                <span className="shrink-0">
                                  [{citation.index}]
                                </span>
                                <span className="font-medium text-ink transition-colors group-hover:text-accent">
                                  {citation.title}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      <div className="mt-7 space-y-8">
                        {result.hits.map((h) => (
                          <FadeUp key={h.slug}>
                            <figure className="border-r border-hair pr-5">
                              <blockquote className="font-display text-[1.06rem] font-light leading-[2] text-ink">
                                «{h.para}»
                              </blockquote>
                              <figcaption className="mt-3 text-[.82rem] text-soft">
                                <Link
                                  to={`/articles/${h.slug}`}
                                  className="transition-colors hover:text-accent"
                                >
                                  {h.title} — {h.iso.slice(0, 4)}
                                </Link>
                              </figcaption>
                            </figure>
                          </FadeUp>
                        ))}
                      </div>

                      {bookVoice.length > 0 && (
                        <div className="mt-9 border-t border-hair pt-6">
                          <p className="text-[.8rem] text-soft">
                            من متن كتبه
                            <span className="mr-2 text-[.72rem] text-soft/70">
                              {passagesReady ? 'بحثٌ في الكتب التسعة كاملة' : 'من المختارات — والكتب كاملة في الطريق'}
                            </span>
                          </p>
                          <div className="mt-3 space-y-4">
                            {bookVoice.map((match) => (
                              <figure key={match.quote.id} className="rounded-xl border border-hair bg-wash px-4 py-3.5">
                                <blockquote className="border-r-2 border-accent/40 pr-3 text-[.92rem] font-light leading-[1.95] text-ink/[.85]">
                                  {match.quote.text}
                                </blockquote>
                                <figcaption className="mt-2 pr-3 text-[.74rem] text-soft">
                                  <Link to={`/publications/${match.bookSlug}#book-knowledge`} className="transition-colors hover:text-accent">
                                    {match.bookTitle}
                                  </Link>
                                  {' · '}ص {match.quote.page}
                                  {match.quote.conceptTitle ? ` · ${match.quote.conceptTitle}` : ''}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.refs.length > 0 && (
                        <div className="mt-9 border-t border-hair pt-6">
                          <p className="text-[.8rem] text-soft">
                            كتب وأبحاث ولقاءات مرتبطة
                          </p>
                          <ul className="mt-3 space-y-3">
                            {result.refs.map((r) => (
                              <li key={r.slug} className="flex gap-3">
                                <span className="w-20 shrink-0 text-[.72rem] text-soft">
                                  {r.kind}
                                </span>
                                <Link
                                  to={r.href}
                                  className="text-[.92rem] text-ink transition-colors hover:text-accent"
                                >
                                  {r.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </section>

                    <FadeUp>
                      <details className="group mt-10 border-t border-hair pt-6">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[.86rem] font-medium text-ink marker:hidden">
                          <span>امتدادات الإجابة</span>
                          <span
                            aria-hidden
                            className="text-soft transition-transform group-open:rotate-45"
                          >
                            ＋
                          </span>
                        </summary>
                        <div className="pb-2 pt-4">
                          {result.timeline.length > 1 && (
                            <section>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-[.78rem] font-medium text-soft">
                                  تطور السؤال عبر الأرشيف
                                </p>
                                {personalBookChapters.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={handlePrintReadingRoute}
                                    aria-label="طباعة مسار القراءة"
                                    title="طباعة مسار القراءة"
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-ink transition-colors hover:border-accent hover:text-accent"
                                  >
                                    <SocialIcon name="Print" size={16} />
                                  </button>
                                )}
                              </div>
                              <ol className="mt-5 grid gap-5 border-r border-hair pr-5">
                                {result.timeline.map((item) => (
                                  <li key={item.slug} className="relative">
                                    <span className="absolute right-[-25px] top-2 h-2 w-2 rounded-full bg-accent" />
                                    <span className="text-[.74rem] text-soft">
                                      {item.iso.slice(0, 4)} · {categoryLabel(item.cat || '')}
                                    </span>
                                    <Link
                                      to={`/articles/${item.slug}`}
                                      className="mt-1 block font-display text-[1rem] font-medium leading-relaxed text-ink transition-colors hover:text-accent"
                                    >
                                      {item.title}
                                    </Link>
                                    {item.excerpt && (
                                      <p className="mt-1 text-[.84rem] leading-relaxed text-soft">
                                        {item.excerpt}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            </section>
                          )}

                          {printBlocked && (
                            <p className="mt-5 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.78rem] text-soft">
                              منع المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.
                            </p>
                          )}

                          {(result.latest || result.tension) && (
                            <section className="mt-10 border-t border-hair pt-7">
                              <p className="text-[.76rem] font-medium text-soft">
                                أحدث إجابة منشورة
                              </p>
                              {result.latest && (
                                <Link
                                  to={`/articles/${result.latest.slug}`}
                                  className="mt-2 block font-display text-[1.1rem] font-semibold leading-relaxed text-ink transition-colors hover:text-accent"
                                >
                                  {result.latest.title}{" "}
                                  <span className="text-[.82rem] font-normal text-soft">
                                    ({result.latest.iso.slice(0, 4)})
                                  </span>
                                </Link>
                              )}
                              {result.tension && (
                                <p className="mt-3 text-[.88rem] font-light leading-[1.9] text-soft">
                                  {result.tension}
                                </p>
                              )}
                            </section>
                          )}
                        </div>
                      </details>
                    </FadeUp>
                  </>
                ) : (
                  <FadeUp>
                    <div className="border-y border-hair py-8 md:py-10">
                      <p className="font-display text-[clamp(1.2rem,2.6vw,1.6rem)] font-semibold leading-[1.7] text-ink">
                        لم أكتب في هذا بعد — ربما يكون سؤالَ مقالٍ قادم.
                      </p>
                      {result.near.length > 0 && (
                        <div className="mt-6 border-t border-hair pt-5">
                          <p className="text-[.82rem] text-soft">
                            الأقرب إليه في مكتبتي:
                          </p>
                          <ul className="mt-3 space-y-2">
                            {result.near.map((n) => (
                              <li key={n.slug}>
                                <Link
                                  to={`/articles/${n.slug}`}
                                  className="group text-[.95rem] text-ink transition-colors hover:text-accent"
                                >
                                  {n.title}{" "}
                                  <span className="text-[.8rem] text-soft">
                                    ({n.iso.slice(0, 4)})
                                  </span>
                                  <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1">
                                    {" "}
                                    ←
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </FadeUp>
                )}
              </div>
            )}
            {result && (
              <div className="mt-10 text-center">
                <button
                  onClick={again}
                  className="min-h-11 border-b border-hair px-1 text-[.86rem] font-medium text-soft transition-colors hover:border-accent hover:text-accent"
                >
                  اسأل سؤالاً آخر ↺
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </Page>
  );
}
