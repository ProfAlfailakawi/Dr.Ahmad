/** Conservative Arabic editorial normalization used at display and save time. */
export function normalizeArabicTypography(input = ''): string {
  return input
    /* ═══ آثار النسخ من Word ═══
       Word يلصق شفرة الحقل نفسها لا الرابط: «HYPERLINK «https://…» النص».
       فتظهر الكلمة الإنجليزية داخل نصٍّ عربي منشور. نمسح شفرة الحقل ونُبقي
       النصّ الذي يليها كما كتبه الدكتور. ويشمل صيغ Word الأخرى: PAGEREF
       وREF ومحدِّدات \o و\l التي تتبع الرابط أحياناً. */
    .replace(/\s*HYPERLINK\s*(?:«[^»]*»|"[^"]*"|'[^']*'|\S+)(?:\s*\\[ol]\s*(?:"[^"]*"|\S+))*\s*/gi, ' ')
    .replace(/\s*(?:PAGEREF|NOTEREF|REF)\s+\S+(?:\s*\\[a-z]\s*)*/gi, ' ')
    /* المسافة غير القاصمة من Word تكسر انسياب العربية وتلتصق بعلامات الترقيم */
    .replace(/\u00a0/g, ' ')
    .replace(/\.\.\.+/g, '…')
    .replace(/\.\./g, '…')
    .replace(/[“”](.*?)[“”]/g, '«$1»')
    .replace(/(^|[\s(])"([^"\n]{2,})"(?=$|[\s،؛؟!.)])/g, '$1«$2»')
    .replace(/[ \t]+([،؛؟!])/g, '$1')
    .replace(/([،؛؟!])(?=[^\s\n»])/g, '$1 ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
