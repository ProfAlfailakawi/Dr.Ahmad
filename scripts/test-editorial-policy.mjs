import assert from "node:assert/strict";

import {
  POLICY,
  evaluateCandidate,
  isAllowedSource,
  normalizeUrl,
} from "./editorial-policy.mjs";

const safeArabicCandidate = {
  title: "منصة تعليمية تساعد المعلمين على توظيف الذكاء الاصطناعي",
  summary: "أداة رقمية تدعم التعلم وتقدم ملاحظات مفيدة للطلاب.",
  source: "EdSurge",
  url: "https://www.edsurge.com/articles/safe-learning-platform",
};

const safeEnglishCandidate = {
  title: "New technology helps teachers improve classroom learning",
  summary: "The educational software gives students timely feedback.",
  source: "MIT Technology Review",
  url: "https://www.technologyreview.com/2026/07/10/safe-education-technology/",
};

function evaluate(candidate) {
  const result = evaluateCandidate(candidate);
  assert.equal(typeof result, "object", "evaluateCandidate must return an object");
  assert.equal(typeof result.allowed, "boolean", "decision.allowed must be boolean");
  assert.ok(Array.isArray(result.reasons), "decision.reasons must be an array");
  return result;
}

function assertBlocked({ label, category, title, summary = "" }) {
  const result = evaluate({
    ...safeArabicCandidate,
    title,
    summary,
    url: `${safeArabicCandidate.url}?case=${encodeURIComponent(label)}`,
  });

  assert.equal(result.allowed, false, `${label} must be rejected`);
  assert.ok(
    result.reasons.includes(`blocked:${category}`),
    `${label} must include blocked:${category}; received ${result.reasons.join(", ")}`,
  );
}

assert.equal(POLICY.version, 1);
assert.equal(POLICY.allowedSources.length, 2, "only the two approved sources are allowed");
assert.deepEqual(
  POLICY.allowedSources.map(({ name }) => name),
  ["MIT Technology Review", "EdSurge"],
);
assert.ok(POLICY.requiredTopics.any.includes("تعليم"));
assert.ok(POLICY.requiredTopics.any.includes("technology"));
assert.deepEqual(
  Object.keys(POLICY.blockedCategories).sort(),
  ["profanity", "racismHate", "religion", "sexual", "unethical", "violence"],
);

const normalized = normalizeUrl("  https://WWW.EDSURGE.COM/articles/test  ");
assert.equal(normalized?.protocol, "https:");
assert.equal(normalized?.hostname, "www.edsurge.com");
assert.equal(normalizeUrl("not a url"), null);

assert.equal(
  isAllowedSource("MIT Technology Review", safeEnglishCandidate.url),
  true,
);
assert.equal(isAllowedSource("EdSurge", safeArabicCandidate.url), true);
assert.equal(
  isAllowedSource("EdSurge", safeEnglishCandidate.url),
  false,
  "an approved publisher name must not be paired with another publisher's host",
);
assert.equal(
  isAllowedSource("EdSurge", "http://www.edsurge.com/articles/insecure"),
  false,
  "HTTP URLs must be rejected",
);
assert.equal(
  isAllowedSource("Unknown Publication", safeArabicCandidate.url),
  false,
  "an unapproved source name must be rejected even on an approved hostname",
);
assert.equal(
  isAllowedSource(
    "MIT Technology Review",
    "https://technologyreview.com.evil.example/story",
  ),
  false,
  "lookalike hostnames must be rejected",
);

for (const [label, candidate] of [
  ["safe Arabic education/technology story", safeArabicCandidate],
  ["safe English education/technology story", safeEnglishCandidate],
]) {
  const result = evaluate(candidate);
  assert.equal(result.allowed, true, `${label} must be accepted`);
  assert.deepEqual(result.reasons, [], `${label} must not have rejection reasons`);
}

const blockedCases = [
  {
    label: "Arabic religion",
    category: "religion",
    title: "تقنية تعليمية تشرح الشعائر الدينية والفتاوى",
  },
  {
    label: "English religion",
    category: "religion",
    title: "Education technology for religious worship and scripture",
  },
  {
    label: "Arabic racism",
    category: "racismHate",
    title: "منصة تعليمية تروج للتفوق العرقي بين الطلاب",
  },
  {
    label: "English racism",
    category: "racismHate",
    title: "Education technology promoting racial supremacy",
  },
  {
    label: "Arabic hate",
    category: "racismHate",
    title: "تقنية تعليمية تحرض على كراهية فئة اجتماعية",
  },
  {
    label: "English hate",
    category: "racismHate",
    title: "Education platform spreading hate speech against a minority",
  },
  {
    label: "Arabic sexual content",
    category: "sexual",
    title: "منصة تعليمية تنشر محتوى جنسي صريح",
  },
  {
    label: "English sexual content",
    category: "sexual",
    title: "Education app containing explicit sexual content",
  },
  {
    label: "Arabic violence",
    category: "violence",
    title: "تقنية تعليمية تشرح صناعة سلاح وتنفيذ هجوم دموي",
  },
  {
    label: "English violence",
    category: "violence",
    title: "Education technology explains how to build a weapon for a violent attack",
  },
  {
    label: "Arabic profanity",
    category: "profanity",
    title: "منصة تعليمية مليئة بألفاظ بذيئة وشتائم",
  },
  {
    label: "English profanity",
    category: "profanity",
    title: "Education platform filled with profanity and obscene language",
  },
  {
    label: "Arabic unethical conduct",
    category: "unethical",
    title: "تقنية تعليمية تساعد على الغش الأكاديمي وسرقة بيانات الطلاب",
  },
  {
    label: "English unethical conduct",
    category: "unethical",
    title: "Education technology for academic cheating and stealing student data",
  },
  {
    label: "Arabic attached-prefix religion",
    category: "religion",
    title: "منصة تعليمية وبالصلاة تبدأ أنشطتها",
  },
  {
    label: "English generic violence",
    category: "violence",
    title: "Technology used in war and armed conflict",
  },
  {
    label: "Arabic explicit profanity",
    category: "profanity",
    title: "منصة تعليمية تعرض كلمة خرا للطلاب",
  },
  {
    label: "English malware",
    category: "unethical",
    title: "Technology course for building malware",
  },
];

for (const blockedCase of blockedCases) {
  assertBlocked(blockedCase);
}

const insecureResult = evaluate({
  ...safeArabicCandidate,
  url: "http://www.edsurge.com/articles/insecure",
});
assert.equal(insecureResult.allowed, false);
assert.ok(insecureResult.reasons.includes("url_not_https"));

const unapprovedSourceResult = evaluate({
  ...safeArabicCandidate,
  source: "Unknown Publication",
});
assert.equal(unapprovedSourceResult.allowed, false);
assert.ok(unapprovedSourceResult.reasons.includes("source_not_allowed"));

const offTopicResult = evaluate({
  ...safeArabicCandidate,
  title: "دليل لاختيار أثاث الحديقة",
  summary: "مقارنة بين أنواع الخشب والألوان المتاحة.",
});
assert.equal(offTopicResult.allowed, false);
assert.ok(offTopicResult.reasons.includes("topic_not_relevant"));

console.log(`Editorial policy tests passed (${blockedCases.length + 9} checks).`);
