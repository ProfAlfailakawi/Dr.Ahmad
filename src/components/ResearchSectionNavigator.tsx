import { motion } from 'framer-motion'

export type ResearchLayer = 'layer1' | 'layer2' | 'layer3'

const levels: Array<{ key: ResearchLayer; label: string; short: string; num: string }> = [
  { key: 'layer1', label: 'الهوية والتوثيق الأكاديمي', short: 'الهوية والتوثيق', num: '٠١' },
  { key: 'layer2', label: 'الأبعاد المنهجية والمحتوى', short: 'الأبعاد المنهجية', num: '٠٢' },
  { key: 'layer3', label: 'الأدلة والمصادر العلمية', short: 'المصادر والقرائن', num: '٠٣' },
]

export function ResearchSectionNavigator({ active, onSelect }: { active: ResearchLayer; onSelect: (layer: ResearchLayer) => void }) {
  return (
    <div
      className="research-section-nav sticky top-16 z-[120] -mx-4 border-b border-hair bg-canvas/95 px-4 py-0.5 backdrop-blur-md transition-all duration-300 sm:-mx-6 sm:px-6 md:-mx-11 md:px-11"
    >
      <div className="mx-auto flex max-w-[960px] items-center justify-between">
        <nav className="flex w-full justify-between gap-2 md:gap-6" aria-label="أقسام البحث الأكاديمي">
          {levels.map((level) => {
            const isActive = active === level.key
            return (
              <button
                key={level.key}
                type="button"
                onClick={() => onSelect(level.key)}
                aria-current={isActive ? 'step' : undefined}
                className="relative flex flex-1 flex-col items-center py-3 text-center transition-colors duration-200 focus:outline-none md:flex-row md:justify-center md:gap-2.5"
              >
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span
                    className={`font-display text-[0.8rem] font-extrabold transition-colors duration-300 md:text-[0.95rem] ${
                      isActive ? 'text-accent' : 'text-soft/80'
                    }`}
                  >
                    {level.num}
                  </span>
                  
                  {/* Fine divider on desktop */}
                  <span className="hidden h-3 w-[1px] bg-hair md:inline-block" />

                  <span
                    className={`text-[0.72rem] font-bold transition-colors duration-300 sm:text-[0.78rem] md:inline-block md:text-[0.82rem] ${
                      isActive ? 'text-ink' : 'text-soft hover:text-ink'
                    }`}
                  >
                    {/* Responsive Labels */}
                    <span className="hidden md:inline">{level.label}</span>
                    <span className="md:hidden">{level.short}</span>
                  </span>
                </div>

                {/* Highly elegant active underbar slider */}
                {isActive && (
                  <motion.div
                    layoutId="active-research-tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
