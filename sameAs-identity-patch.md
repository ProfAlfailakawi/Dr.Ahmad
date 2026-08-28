# تعديل توحيد الهوية — build-static.mjs (اختياري)

**الملف:** `build-static.mjs`
**الموضع:** كتلة `const PERSON = { ... }` (قرابة السطر 57–78)، تحديداً حقل `sameAs` (قرابة السطر 71).
**نوع التغيير:** توسيع قائمة روابط `sameAs` وإضافة سطر `identifier` (ORCID). لا مساس بأي منطق آخر.

---

## قبل (الحالي)
```js
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Northern Colorado' },
  sameAs: [
    'https://scholar.google.com/citations?user=WVAtInIAAAAJ&hl=en',
    'https://www.researchgate.net/profile/Ahmad-Alfailakawi',
  ],
}
```

## بعد (البديل)
```js
  alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Northern Colorado' },
  identifier: {
    '@type': 'PropertyValue',
    propertyID: 'ORCID',
    value: 'https://orcid.org/0000-0002-1767-4963',
  },
  sameAs: [
    'https://orcid.org/0000-0002-1767-4963',
    'https://www.wikidata.org/wiki/Q141131823',
    'https://scholar.google.com/citations?user=WVAtInIAAAAJ&hl=en',
    'https://www.researchgate.net/profile/Ahmad-Alfailakawi',
    'https://www.linkedin.com/in/prof-ahmad-alfailakawi-5922251a5',
    'https://twitter.com/drahmadkw',
    'https://www.instagram.com/DrAhmadkw/',
    'https://www.facebook.com/d.ahmd.alfylkawy',
    'https://youtube.com/@drahmadalfailakawi',
  ],
}
```

---

## لاحقاً: كل ملف جديد تُنشئه = سطر جديد في `sameAs`
مع تسجيلك في المنصّات، أضف رابط ملفّك العلني إلى نفس القائمة، مثلاً:
```js
    'https://www.scopus.com/authid/detail.uri?authorId=XXXXXXXX',
    'https://www.webofscience.com/wos/author/record/XXXXXXX',
    'https://openalex.org/AXXXXXXXXX',
    'https://www.semanticscholar.org/author/XXXXXXX',
    'https://www.goodreads.com/author/show/XXXXXXX',
```
كلما زادت الروابط الموثوقة، زاد يقين غوغل ومحرّكات الذكاء الاصطناعي أنها كلها شخص واحد = د. أحمد الفيلكاوي.

## التحقّق بعد التطبيق
- شغّل بناء الموقع كالمعتاد وتأكّد أنه يمرّ بلا أخطاء.
- افحص السكيمة على: https://validator.schema.org/ (الصق رابط الصفحة الرئيسية بعد النشر).
- الأثر يظهر تدريجياً في نتائج غوغل خلال أسابيع (إعادة الزحف).
