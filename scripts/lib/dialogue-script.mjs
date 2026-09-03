/**
 * محوِّل نصّ الحوار إلى مداخلات — مصدرٌ واحد لا نسختان.
 *
 * كان هذا المحوِّل ساكناً في `upload-dialogues.mjs`، وذاك ملفٌّ يقرأ `sa.json`
 * ويرفع إلى Firestore بمجرّد تحميله. فمن أراد المحوِّل وحده اضطُرّ أن يوقظ
 * الرفعَ معه. أُخرج هنا ليستورده من شاء بلا أثرٍ جانبيّ.
 *
 * وهو مطابقٌ حرفاً بحرف لخريطة محرّر اللوحة: أيّ اختلافٍ هنا يُغيّر الأداء
 * الصوتيّ عمّا يراه الدكتور في الشاشة، ويكسر البصمة المقفولة في السحابة.
 */
/* الخريطة نفسها الموجودة في محرّر اللوحة — أيّ اختلافٍ هنا يُغيّر الأداء
   الصوتيّ عمّا يراه الدكتور في الشاشة، فتُنسخ حرفاً بحرف لا اجتهاداً. */
export const TYPE_TAGS = {
  'خبر': 'statement', 'سؤال': 'question', 'رد': 'response', 'تأمل': 'reflection', 'اعتراض': 'objection',
  'اعتراض هادئ': 'gentleObjection', 'شرح': 'explanation', 'توضيح': 'clarification', 'تمهيد': 'setup',
  'مثال': 'example', 'تأكيد': 'emphasis', 'رد قصير': 'briefReaction', 'خلاصة': 'conclusion', 'إغلاق': 'closing',
}
export const TYPE_PAUSES = {
  statement: 560, question: 680, response: 520, reflection: 760, objection: 640, gentleObjection: 620,
  explanation: 600, clarification: 600, setup: 640, example: 580, emphasis: 620, briefReaction: 240,
  conclusion: 900, closing: 900,
}

/** نصّ الدكتور ⇐ مداخلاتٌ يفهمها المحرك */
export function scriptToTurns(script) {
  const lines = String(script || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
  const turns = []
  for (const line of lines) {
    const match = line.match(/^(الرجل|المرأة)\s*[:：]\s*(.+)$/u)
    if (!match) { if (turns.length) turns[turns.length - 1].text += ` ${line}`; continue }
    turns.push({ speaker: match[1] === 'الرجل' ? 'male' : 'female', text: match[2].trim(), deliveryType: 'statement', pauseAfterMs: 560, overlapMs: 0, musicBridgeAfter: false })
  }
  turns.forEach((turn, index) => {
    let lockedType = false
    let lockedPause = false
    turn.text = turn.text.replace(/\[([^\]]{1,24})\]/g, (_, rawTag) => {
      const tag = String(rawTag).trim()
      const pause = tag.match(/^وقفة\s*(\d{2,4})$/)
      const overlap = tag.match(/^تداخل\s*(\d{1,3})$/)
      if (tag === 'موسيقى') turn.musicBridgeAfter = true
      else if (pause) { turn.pauseAfterMs = Math.min(2000, Number(pause[1])); lockedPause = true }
      else if (overlap) turn.overlapMs = Math.min(150, Number(overlap[1]))
      else if (TYPE_TAGS[tag]) { turn.deliveryType = TYPE_TAGS[tag]; lockedType = true }
      return ' '
    }).replace(/\s+/g, ' ').trim()
    if (!lockedType) {
      if (/[؟?]\s*$/.test(turn.text)) turn.deliveryType = 'question'
      else if (turn.text.split(/\s+/).length <= 8) turn.deliveryType = 'briefReaction'
      else if (index === turns.length - 1) turn.deliveryType = 'conclusion'
    }
    if (!lockedPause) turn.pauseAfterMs = TYPE_PAUSES[turn.deliveryType] ?? 560
  })
  return turns
}
