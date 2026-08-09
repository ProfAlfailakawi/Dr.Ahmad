export type ResearchLayer = 'layer1' | 'layer2' | 'layer3'

const levels: Array<{ key: ResearchLayer; label: string; short: string }> = [
  { key: 'layer1', label: 'الهوية والتوثيق', short: 'التوثيق' },
  { key: 'layer2', label: 'الأبعاد المنهجية', short: 'المنهج' },
  { key: 'layer3', label: 'الأدلة والمصادر', short: 'المصادر' },
]

export function ResearchSectionNavigator({ active, onSelect }: { active: ResearchLayer; onSelect: (layer: ResearchLayer) => void }) {
  return (
    <div
      className="research-section-nav sticky z-[35] -mx-4 mb-6 mt-4 bg-canvas px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 md:-mx-11 md:px-11"
      style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
    >
      <nav className="mx-auto max-w-[960px] rounded-2xl border border-hair bg-paper p-1.5" aria-label="التنقل داخل البحث">
        <div className="grid grid-cols-3 gap-1">
        {levels.map((level, index) => (
          <button key={level.key} type="button" onClick={() => onSelect(level.key)} aria-current={active === level.key ? 'step' : undefined} className={`min-h-[3.55rem] rounded-xl border border-transparent px-2 py-2.5 text-center transition-[background-color,color,border-color] duration-150 sm:px-4 ${active === level.key ? 'border-accent bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>
            <span className="block text-[.62rem] font-semibold opacity-75">0{index + 1}</span>
            <span className="mt-0.5 block text-[.7rem] font-bold sm:hidden">{level.short}</span>
            <span className="mt-0.5 hidden text-[.76rem] font-bold sm:block">{level.label}</span>
          </button>
        ))}
        </div>
      </nav>
    </div>
  )
}
