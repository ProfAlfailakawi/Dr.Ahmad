/** Conservative Arabic editorial normalization used at display and save time. */
export function normalizeArabicTypography(input = ''): string {
  return input
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
