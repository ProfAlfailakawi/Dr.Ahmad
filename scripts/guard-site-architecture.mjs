import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const checks = []
const assert = (condition, label) => {
  if (!condition) throw new Error(`Architecture guard failed: ${label}`)
  checks.push(label)
}

const admin = read('src/pages/Admin.tsx')
const registry = read('src/components/admin/admin-navigation.ts')
const architecture = read('src/components/admin/AdminArchitecture.tsx')
const home = read('src/pages/Home.tsx')
const app = read('src/App.tsx')
const cv = read('src/pages/CV.tsx')
const thought = read('src/pages/ThoughtOverview.tsx')
const health = read('src/components/admin/ProductionHealthCenter.tsx')
const analytics = read('src/components/admin/VisitorJourneySuggestion.tsx')
const whatsapp = read('src/components/admin/WhatsAppAgentPanel.tsx')
const publishing = read('src/components/admin/PublishingStudio.tsx')
const publishingNavigation = read('src/components/admin/PublishingStudioNavigation.tsx')
const intelligence = read('src/components/admin/IntelligenceLab.tsx')
const design = read('src/components/admin/SocialDesignStudio.tsx')
const contentManager = read('src/components/admin/ContentManager.tsx')
const staticBuild = read('scripts/build-static.mjs')
const packageJson = read('package.json')
const architectureDoc = read('ARCHITECTURE.md')

assert(registry.includes("tab: 'sound-caravan'") && registry.includes("label: 'إعدادات الصوت'"), 'sound architecture lives in the registry')
assert(admin.includes('ADMIN_TABS.includes(requestedTab)') && !admin.includes('const allowedTabs'), 'admin deep links derive from registry')
assert(admin.includes('const tabContent: Record<AdminTab, ReactNode>') && admin.includes("'sound-caravan': <SoundCaravanBoard"), 'admin render map is exhaustive and keeps sound-caravan deep links')
assert(architecture.includes('AdminSidebar') && architecture.includes('AdminMobileSubnav'), 'responsive admin navigation is official')
assert(home.includes('role="dialog"') && home.includes('aria-modal="true"') && home.includes('home-thought-maps-dialog') && home.includes("event.key !== 'Tab'"), 'home thought maps modal is accessible')
assert(app.includes('path="/en/contact"') && staticBuild.includes("path: '/en/contact'"), 'English journey has live and static contact endpoints')
assert(cv.includes('<CvDownloadCards'), 'CV files are near the top through a dedicated component')
assert(!thought.includes('<ThoughtHub') && staticBuild.includes("path: '/thought'"), 'thought overview remains public without the duplicated ThoughtHub cards')
assert(!health.includes('اقتراح يتكوّن من رحلة كل زائر') && analytics.includes('اقتراح'), 'visitor journey belongs to analytics')
assert(whatsapp.includes("id: 'campaigns'") && whatsapp.includes("screen === 'campaigns'"), 'WhatsApp campaigns have their own screen')
assert(publishing.includes('<PublishingStudioNavigation') && publishingNavigation.includes('مسار المقال') && publishingNavigation.includes('منشور مستقل'), 'publishing separates the article journey from the standalone path')
// كلمة design مشروعة داخل جواز النشر وبيانات الحملة؛ ما نمنعه هو إعادة
// المرحلة القديمة نفسها إلى تنقّل الاستوديو، لا ورود اسم طبقة التصميم.
assert(!publishing.includes("setView('design')") && !publishingNavigation.includes("id: 'design'") && !publishingNavigation.includes("value: 'design'"), 'stale publishing design stage cannot return')
assert(health.includes('<AudioSystemOverview') && intelligence.includes('AudioWorkspaceBridge') && !intelligence.includes('PodcastControlRoom'), 'advanced lab links to the official audio system instead of duplicating it')
assert(design.includes('<GenerationLibraryPanel') && contentManager.includes('<ContentManagerHeader'), 'large studios are split into maintained internal modules')
assert(packageJson.includes('node scripts/guard-site-architecture.mjs') && architectureDoc.includes('لا تُحذف ميزة'), 'architecture contract is documented and enforced during build')

console.log(`Architecture guard passed (${checks.length} checks).`)
