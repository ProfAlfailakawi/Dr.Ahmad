import { BookCheck, MessageCircleQuestion, Quote, Search } from 'lucide-react'
import { JourneyStepper, type JourneyStation } from './JourneyStepper'

/**
 * «كيف يُبنى الجواب؟» — أربع محطّات تُضاء واحدةً بعد أخرى حين تدخل الشاشة (JourneyStepper).
 *
 * الخطوات مطابقة لما تفعله «اسأل المكتبة» فعلاً: السؤال، ثم بحثٌ في المقالات
 * والأبحاث والكتب، ثم مقاطعُ حرفية منها، ثم جوابٌ مرتبط بمصادره. وإن لم
 * يوجد دليلٌ يقول ذلك صراحةً (انظر وعد الصفحة أعلاه).
 *
 * عرض شرحيّ فقط: لا يقرأ بيانات ولا يغيّر حالة، وكلّ محطّاته «منجزة» لأنه يصف ما
 * يحدث دائماً لا تقدّماً لأحد. ومن أطفأ الحركة — أو بلا JS — يراه مكتملاً ساكناً.
 */
const STEPS = [
  { Icon: MessageCircleQuestion, title: 'سؤالك', note: 'اكتبه بكلماتك' },
  { Icon: Search, title: 'البحث في الكتب', note: 'والمقالات والأبحاث' },
  { Icon: Quote, title: 'المقاطع', note: 'النص الحرفي الذي استُند إليه' },
  { Icon: BookCheck, title: 'جواب موثّق بمصادره', note: 'أو يقول لك إن لم يجد دليلاً' },
] as const

const STATIONS: JourneyStation[] = STEPS.map(({ Icon, title, note }) => ({ key: title, label: title, note, Icon, state: 'done' }))

export function AskHowItWorks() {
  return (
    <section aria-label="كيف يُبنى الجواب" className="mt-12 border-t border-hair pt-8">
      <p className="text-[.75rem] font-medium text-soft">كيف يُبنى الجواب</p>
      <JourneyStepper steps={STATIONS} variant="full" playKey="ask-how-it-works" className="mt-6" />
    </section>
  )
}
