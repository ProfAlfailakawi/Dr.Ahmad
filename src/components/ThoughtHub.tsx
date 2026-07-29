import { Link } from 'react-router-dom'
import { FadeUp } from './ui'

const destinations = [
  { to: '/atlas', index: '01', title: 'سماء المقالات', description: 'الأرشيف كما يبدو من الأعلى: الزمن، المحاور، وكثافة الكتابة.' },
  { to: '/thought-paths', index: '02', title: 'مسارات الفكرة', description: 'كيف بدأت الفكرة، وأين اتسعت، وما الذي اتصل بها داخل الأرشيف.' },
  { to: '/decade', index: '03', title: 'وثيقة العقد', description: 'أكثر من عشر سنوات من التحولات والأسئلة المتكررة في سجل واحد.' },
  { to: '/impact', index: '04', title: 'سجل الأثر', description: 'الامتدادات الموثقة، والاستجابات، وما عاد من الفكرة إلى الواقع.' },
] as const

export function ThoughtHub() {
  return (
    <FadeUp delay={0.02}>
      <section className="mt-8 rounded-[1.75rem] border border-hair bg-wash p-5 md:p-7" aria-labelledby="thought-hub-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[.7rem] font-semibold text-accent">أبواب الخريطة</p>
            <h2 id="thought-hub-title" className="mt-1 font-display text-2xl font-semibold text-ink">اختر زاوية الدخول إلى الفكرة.</h2>
          </div>
          <p className="max-w-md text-[.76rem] font-light leading-relaxed text-soft">أربع شاشات مستقلة، يجمعها هنا باب واحد من دون تكرار محتواها.</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {destinations.map((item) => (
            <Link key={item.to} to={item.to} className="group flex min-h-[148px] flex-col justify-between rounded-2xl border border-hair bg-canvas p-5 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-sm">
              <span className="text-[.68rem] font-semibold text-accent">{item.index}</span>
              <span>
                <strong className="block font-display text-[1.08rem] font-semibold text-ink transition-colors group-hover:text-accent">{item.title}</strong>
                <span className="mt-2 block text-[.76rem] font-light leading-[1.75] text-soft">{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </FadeUp>
  )
}
