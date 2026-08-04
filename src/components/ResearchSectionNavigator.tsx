export type ResearchLayer = 'layer1' | 'layer2' | 'layer3'

const levels: Array<{ key: ResearchLayer; label: string; short: string }> = [
  { key: 'layer1', label: 'الهوية والتوثيق', short: 'التوثيق' },
  { key: 'layer2', label: 'الأبعاد المنهجية', short: 'المنهج' },
  { key: 'layer3', label: 'الأدلة والمصادر', short: 'المصادر' },
]

export function ResearchSectionNavigator({ active, onSelect }: { active: ResearchLayer; onSelect: (layer: ResearchLayer) => void }) {
  return (
    <nav className="research-section-navigator sticky top-[4.75rem] z-30 mt-4 rounded-2xl border border-hair bg-canvas p-1.5" aria-label="التنقل داخل البحث">
      <div className="grid grid-cols-3 gap-1">
        {levels.map((level, index) => (
          <button key={level.key} type="button" onClick={() => onSelect(level.key)} aria-current={active === level.key ? 'step' : undefined} className={`rounded-xl px-2 py-2.5 text-center transition-colors sm:px-4 ${active === level.key ? 'bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>
            <span className="block text-[.62rem] font-semibold opacity-75">0{index + 1}</span>
            <span className="mt-0.5 block text-[.7rem] font-bold sm:hidden">{level.short}</span>
            <span className="mt-0.5 hidden text-[.76rem] font-bold sm:block">{level.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
