import { getDb } from './firebase'

/**
 * ما توقّف عنده القرّاء — في مقاطع الكتب.
 *
 * الموقع يرصد منذ مدةٍ ما يظلّله القارئ في المقالات (`article_highlights`).
 * وهذا يمدّ الرصد نفسه إلى مقاطع الكتب: أي مقطعٍ يظلّله الناس يرتفع في
 * صفحة الكتاب، فيصير الترتيب **بما اختاره القرّاء** لا بما رجّحته خوارزمية.
 *
 * الأدب المفروض على هذا الملف:
 *   · لا يُخزَّن نصّ ولا هويّة قارئ — رقم مقطعٍ وعدّاد فقط.
 *   · الفشل صامت: التظليل متعةٌ للقارئ لا واجبٌ عليه، فلا يُزعجه خطأ شبكة.
 *   · لا شارة قبل ثلاثة قرّاء — واحدٌ ليس إجماعاً، وعرضه ضجيج.
 */

const COLLECTION = 'passage_highlights'

/** لا نُظهر أثر القرّاء قبل هذا العدد: أقلّ منه صدفةٌ لا دلالة. */
export const RESONANCE_FLOOR = 3

let cache: Map<string, number> | null = null
let pending: Promise<Map<string, number>> | null = null

/** يقرأ عدّادات كل المقاطع مرّةً واحدة ويحتفظ بها في الذاكرة. */
export function loadPassageResonance(): Promise<Map<string, number>> {
  if (cache) return Promise.resolve(cache)
  if (!pending) {
    pending = (async () => {
      const map = new Map<string, number>()
      try {
        const db = await getDb()
        if (!db) return map
        const { collection, getDocs } = await import('firebase/firestore')
        const snapshot = await getDocs(collection(db, COLLECTION))
        for (const document of snapshot.docs) {
          const count = Number((document.data() as { count?: unknown }).count || 0)
          if (count > 0) map.set(document.id, count)
        }
      } catch {
        /* لا شبكة أو لا صلاحية: الصفحة تعمل بلا أثر القرّاء. */
      }
      cache = map
      return map
    })()
  }
  return pending
}

/** يسجّل توقّف قارئ عند مقطع. يُستدعى مرّة واحدة لكل تظليل. */
export async function recordPassageHighlight(passageId: string) {
  const id = String(passageId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80)
  if (!id) return
  try {
    const db = await getDb()
    if (!db) return
    const { doc, increment, setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, COLLECTION, id), { count: increment(1) }, { merge: true })
    if (cache) cache.set(id, (cache.get(id) || 0) + 1)
  } catch {
    /* صامت عمداً — انظر أدب الملف أعلاه. */
  }
}
