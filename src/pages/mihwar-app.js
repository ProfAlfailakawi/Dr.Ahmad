// واجهة «مِحور». تُبنى بالـDOM وtextContent فقط (لا innerHTML لأي محتوى وارد)،
// وتعمل داخل Shadow DOM كي لا تتأثر بأنماط الموقع.
import {
  DEFAULT_INTERESTS, scoreItem, approxDate, reasonText, safeUrl, deadlineStatus, daysUntil, normalizeText,
} from './mihwar-core.mjs'
import {
  APPLICATION_STATUSES, COLLECTIONS, blankState, migrate, mergeStates, validateBackup, rankFeed, isFresh, buildDigest, fiveMinutePlan,
  toCsvRows, buildIcs, compactItem, newId,
} from './mihwar-state.mjs'

export function initMihwar(root, bridge) {
  const $ = (s) => root.querySelector(s)
  const SAVE_DELAY = 700
  const NAMES = { research: 'بحث', conferences: 'مؤتمر أو فرصة', projects: 'مشروع', achievements: 'إنجاز', tasks: 'مهمة', ideas: 'فكرة', appointments: 'موعد' }
  const PLURAL = { research: 'الأبحاث', conferences: 'المؤتمرات والفرص', projects: 'المشاريع', achievements: 'الإنجازات', tasks: 'المهام', ideas: 'الأفكار', appointments: 'المواعيد' }
  const PLAIN = { research: 'أبحاث', conferences: 'مؤتمرات أو فرص', projects: 'مشاريع', achievements: 'إنجازات', tasks: 'مهام', ideas: 'أفكار', appointments: 'مواعيد' }
  const WORK_TABS = [['ملخص', 'summary'], ['أبحاث', 'research'], ['مؤتمرات وفرص', 'conferences'], ['مشاريع', 'projects'], ['مهام', 'tasks'], ['أفكار', 'ideas'], ['إنجازات', 'achievements'], ['مواعيد', 'appointments']]
  const WORLD_TABS = ['لك', 'الأحدث', 'الأبحاث', 'مقالات وأخبار', 'مؤتمرات وفرص', 'المحفوظات']
  const STATUS = {
    research: ['فكرة', 'إعداد', 'قيد التحكيم', 'مقدّم', 'مراجعة', 'مقبول', 'منشور'],
    projects: ['نشط', 'متوقف', 'مكتمل', 'مؤرشف'],
    ideas: ['جديدة', 'قيد النضج', 'تحولت إلى مشروع', 'مؤجلة'],
  }
  const FIELDS = {
    research: [['title', 'العنوان', 'text', true], ['authors', 'المؤلفون'], ['venue', 'المجلة أو الجهة'], ['url', 'DOI أو رابط', 'url'], ['year', 'السنة'], ['status', 'الحالة', 'select'], ['deadline', 'موعد قادم (تقديم/مراجعة)', 'date'], ['keywords', 'كلمات مفتاحية'], ['notes', 'ملاحظات', 'textarea']],
    conferences: [['title', 'الاسم', 'text', true], ['kind', 'النوع', 'select'], ['organization', 'الجهة'], ['location', 'البلد أو المدينة'], ['mode', 'نمط المشاركة', 'select'], ['url', 'الرابط الرسمي', 'url'], ['deadline', 'آخر موعد للتقديم', 'date'], ['eventDate', 'موعد الفعالية', 'date'], ['fees', 'الرسوم'], ['status', 'حالة التقديم', 'select'], ['notes', 'ملاحظات', 'textarea']],
    projects: [['title', 'اسم المشروع', 'text', true], ['description', 'الهدف المختصر', 'textarea'], ['status', 'الحالة', 'select'], ['start', 'البداية', 'date'], ['deadline', 'الموعد المستهدف', 'date'], ['keywords', 'كلمات تربط المواد الجديدة بالمشروع (عبارات واضحة، بفواصل)'], ['notes', 'ملاحظات', 'textarea']],
    achievements: [['title', 'الإنجاز', 'text', true], ['kind', 'النوع'], ['organization', 'الجهة'], ['date', 'التاريخ', 'date'], ['description', 'الوصف', 'textarea'], ['url', 'رابط التوثيق', 'url']],
    tasks: [['title', 'المهمة', 'text', true], ['priority', 'الأولوية', 'select'], ['deadline', 'الموعد', 'date'], ['description', 'تفاصيل', 'textarea']],
    ideas: [['title', 'الفكرة', 'text', true], ['status', 'الحالة', 'select'], ['description', 'تفاصيل', 'textarea']],
    appointments: [['title', 'الموعد', 'text', true], ['date', 'التاريخ', 'date', true], ['time', 'الوقت', 'time'], ['location', 'المكان أو الرابط'], ['notes', 'ملاحظات', 'textarea']],
  }
  const SELECTS = {
    status: (key) => (key === 'conferences' ? APPLICATION_STATUSES : STATUS[key] || []),
    kind: () => ['مؤتمر', 'دعوة أوراق', 'منحة', 'زمالة', 'وظيفة أكاديمية', 'أخرى'],
    mode: () => ['غير محدد', 'حضوري', 'عن بُعد', 'هجين'],
    priority: () => ['عالية', 'متوسطة', 'منخفضة'],
  }
  const WORK_SORTS = { default: ['الأحدث تعديلاً', (a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))], deadline: ['الأقرب موعداً', (a, b) => String(a.deadline || a.date || '9999').localeCompare(String(b.deadline || b.date || '9999'))], title: ['حسب العنوان', (a, b) => String(a.title).localeCompare(String(b.title), 'ar')] }
  const WORLD_SORTS = { rank: 'الأنسب لك', date: 'الأحدث نشراً', deadline: 'الأقرب موعداً' }

  // ---------- أدوات ----------
  const el = (tag, cls, txt, attrs) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt !== undefined && txt !== null) x.textContent = txt; if (attrs) for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v); return x }
  const button = (label, fn, cls = 'btn small', attrs) => { const b = el('button', cls, label, { type: 'button', ...(attrs || {}) }); b.onclick = fn; return b }
  const link = (label, href, cls = 'src-link') => { const url = safeUrl(href); if (!url) return null; const a = el('a', cls, label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; return a }
  const fmtDate = (iso, short) => { if (!iso) return ''; const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('ar-KW-u-nu-latn', short ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' }) : '' }
  const fmtDateTime = (iso) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleString('ar-KW-u-nu-latn', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—' }
  const clean = normalizeText
  const nowIso = () => new Date().toISOString()
  const empty = (title, desc, action) => { const e = el('div', 'empty'); e.append(el('strong', '', title), el('span', '', desc)); if (action) e.append(action); return e }
  const approxLabel = (x) => (x.month ? new Date(Date.UTC(x.year, x.month - 1, 15)).toLocaleDateString('ar-KW-u-nu-latn', { year: 'numeric', month: 'long' }) : 'سنة ' + x.year) + ' (اليوم غير معلن)'
  const chipStatus = (st) => el('span', 'dl dl-' + st.tone, st.label)

  // ---------- الحالة ----------
  let state = blankState()
  let rev = 0
  let dirty = false
  let feed = { meta: null, items: [], error: null, loaded: false }
  let sync = { status: 'loading', at: null, message: '' }
  let ui = { space: 'world', tab: 'لك', workTab: 'ملخص', q: '', filters: {}, sort: 'rank', missed: false, five: false, visible: 12, onlyConfirmed: false }
  let ver = 0; let saveTimer = null; let saving = false; let toastTimer; let previousFocus = null; let previousVisit = null
  const sessionVisit = nowIso()
  const disposers = []
  const allFeedById = () => new Map(feed.items.map((i) => [i.id, i]))
  const itemById = (id) => feed.items.find((i) => i.id === id) || state.pinned[id] || null

  // ---------- الحفظ والمزامنة ----------
  function setSync(status, message = '') {
    sync = { status, at: status === 'saved' ? nowIso() : sync.at, message }
    const dot = $('#syncDot'); const text = $('#syncText')
    const map = { loading: ['', 'جارٍ التحميل…'], saved: ['ok', 'محفوظ في حسابك · ' + fmtDateTime(sync.at)], saving: ['busy', 'جارٍ الحفظ…'], offline: ['warn', 'غير متصل — تغييراتك محفوظة على هذا الجهاز وتُرسل عند عودة الاتصال'], conflict: ['warn', 'تعارض مع جهاز آخر…'], error: ['err', message || 'تعذر الحفظ'] }
    const [cls, label] = map[status] || map.error
    dot.className = 'status-dot ' + cls; text.textContent = label
    renderBanner()
  }

  function touch() {
    dirty = true; ver++
    bridge.pending.write({ state, baseRev: rev, at: nowIso() })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, SAVE_DELAY)
    render()
  }

  async function flush(attempt = 0) {
    if (saving) { saveTimer = setTimeout(flush, 400); return }
    if (!dirty) return
    saving = true; setSync('saving')
    try {
      const sentVer = ver
      const result = await bridge.save(state, rev)
      rev = result.rev
      if (ver === sentVer) { dirty = false; bridge.pending.clear() } else { bridge.pending.write({ state, baseRev: rev, at: nowIso() }); saveTimer = setTimeout(flush, 200) }
      setSync('saved')
    } catch (error) {
      const code = error?.code
      if (code === 'conflict' && attempt < 3) {
        setSync('conflict')
        state = mergeStates(state, error.remote.state)
        rev = error.remote.rev
        bridge.pending.write({ state, baseRev: rev, at: nowIso() })
        toast('دُمجت تغييرات من جهاز آخر مع تغييراتك دون فقد أي عنصر.')
        saving = false; render(); return flush(attempt + 1)
      }
      if (code === 'offline') setSync('offline')
      else if (code === 'too-large') { setSync('error', 'حجم بياناتك تجاوز الحد. صدّر نسخة احتياطية ثم احذف عناصر قديمة.'); toast('حجم البيانات تجاوز الحد المسموح؛ لم يُحفظ آخر تغيير.') }
      else setSync('error', code === 'permission-denied' ? 'لا صلاحية للحفظ. أعد تسجيل الدخول.' : 'تعذر الحفظ. بياناتك ما زالت على هذا الجهاز.')
    } finally { saving = false }
  }
  const retryNow = () => { clearTimeout(saveTimer); flush() }

  function mutate(fn) { fn(); touch() }
  function stamp(rec) { rec.updated = nowIso(); return rec }

  async function load() {
    try {
      const remote = await bridge.load()
      rev = remote.rev
      const wasV1 = remote.state && remote.state.version === 1
      state = migrate(remote.state)
      const pending = bridge.pending.read()
      if (pending?.state) {
        state = mergeStates(pending.state, state)
        dirty = true
        toast('استُعيدت تغييرات غير مرسلة من هذا الجهاز ودُمجت مع حسابك.')
      }
      if (wasV1) { dirty = true; bridge.createBackup(remote.state, 'قبل ترحيل مِحور إلى النسخة 2').catch(() => undefined) }
      setSync(dirty ? 'saving' : 'saved')
      if (!dirty) sync.at = nowIso()
      previousVisit = state.lastVisit
    } catch (error) {
      setSync(navigator.onLine ? 'error' : 'offline', 'تعذر تحميل بياناتك الخاصة. لم يُغيَّر شيء. حاول إعادة فتح الصفحة.')
      renderBanner(); render(); return
    }
    render()
    loadFeed()
    if (dirty) flush()
    setTimeout(() => { if (!state.lastVisit || Date.now() - new Date(state.lastVisit) > 600000) { state.lastVisit = sessionVisit; touchQuiet() } dailyBackup() }, 1500)
    bridge.subscribe((remote) => {
      if (remote.rev > rev && !dirty && !saving) { state = migrate(remote.state); rev = remote.rev; toast('حُدّثت بياناتك من جهاز آخر.'); setSync('saved'); render() }
    }).then((unsub) => unsub && disposers.push(unsub)).catch(() => undefined)
  }
  function touchQuiet() { dirty = true; ver++; bridge.pending.write({ state, baseRev: rev, at: nowIso() }); clearTimeout(saveTimer); saveTimer = setTimeout(flush, SAVE_DELAY) }

  async function dailyBackup() {
    if (state.lastBackup && Date.now() - new Date(state.lastBackup) < 86400000) return
    if (!COLLECTIONS.some((k) => state[k].length)) return
    try { await bridge.createBackup(state, 'تلقائية يومية'); state.lastBackup = nowIso(); touchQuiet() } catch { /* لا تعطّل التطبيق */ }
  }

  async function loadFeed(manual) {
    const btn = $('#refreshBtn'); btn.disabled = true; btn.textContent = 'جارٍ القراءة…'
    const before = feed.meta?.updatedAt
    feed = { ...(await bridge.feed()), loaded: true }
    btn.disabled = false; btn.textContent = 'تحديث المصادر'
    if (manual) toast(feed.error ? (feed.error === 'offline' ? 'لا اتصال بالشبكة؛ المواد السابقة معروضة.' : 'تعذرت قراءة المصادر الآن.') : feed.meta?.updatedAt === before ? 'لا جديد منذ آخر تحديث للمصادر (' + fmtDateTime(feed.meta?.updatedAt) + ').' : 'قُرئ آخر تحديث للمصادر.')
    render()
  }

  // ---------- إشعارات ----------
  function toast(text, action) {
    const t = $('#toast'); t.replaceChildren(el('span', '', text))
    if (action) t.append(button(action.label, () => { action.fn(); t.classList.remove('show') }, 'btn small toast-btn'))
    t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), action ? 7000 : 4200)
  }
  function renderBanner() {
    const b = $('#banner'); const msgs = []
    if (sync.status === 'offline') msgs.push(['warn', 'أنت غير متصل. ما تضيفه الآن يُحفظ على جهازك مؤقتاً ويُرسل تلقائياً عند عودة الاتصال.'])
    if (sync.status === 'error') { msgs.push(['err', sync.message || 'تعذر الحفظ.', ['إعادة المحاولة', retryNow]]) }
    if (feed.loaded && feed.error) msgs.push(['warn', feed.error === 'offline' ? 'تعذرت قراءة المصادر لعدم الاتصال.' : 'تعذرت قراءة مصادر العالم الآن؛ بقية التطبيق يعمل.', ['إعادة', () => loadFeed(true)]])
    b.replaceChildren(); b.hidden = !msgs.length
    for (const [tone, text, act] of msgs) { const row = el('div', 'banner-row banner-' + tone); row.append(el('span', '', text)); if (act) row.append(button(act[0], act[1], 'btn small')); b.append(row) }
  }

  // ---------- الدرج ----------
  function openDrawer(title, content) {
    if (!$('#drawer').classList.contains('show')) previousFocus = root.activeElement || document.activeElement
    $('#drawerTitle').textContent = title
    const body = $('#drawerBody'); body.replaceChildren()
    if (typeof content === 'string') body.append(el('p', '', content)); else body.append(content)
    $('#overlay').classList.add('show'); const d = $('#drawer'); d.classList.add('show'); d.setAttribute('aria-hidden', 'false'); $('#drawerTitle').focus()
  }
  function closeDrawer() {
    const d = $('#drawer'); if (!d.classList.contains('show')) return
    $('#overlay').classList.remove('show'); d.classList.remove('show'); d.setAttribute('aria-hidden', 'true'); previousFocus?.focus?.()
  }
  function trapFocus(e) {
    const d = $('#drawer'); if (e.key !== 'Tab' || !d.classList.contains('show')) return
    const f = [...d.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]')].filter((x) => x.offsetParent !== null)
    if (!f.length) return
    const first = f[0]; const last = f[f.length - 1]; const active = root.activeElement
    if (e.shiftKey && (active === first || active === $('#drawerTitle'))) { e.preventDefault(); last.focus() } else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
  }

  // ---------- المنطق المساعد ----------
  const activeInterests = () => state.interests.filter((i) => i.active !== false)
  function worldList() {
    const ranked = rankFeed(feed.items, state)
    const byTab = { 'الأبحاث': (r) => r.item.type === 'بحث', 'مقالات وأخبار': (r) => ['مقال', 'خبر'].includes(r.item.type), 'مؤتمرات وفرص': (r) => r.item.type === 'مؤتمر' }
    let rows = ranked.filter((r) => (!state.ignored[r.item.id] || state.saved[r.item.id]) && (r.item.type !== 'مؤتمر' || deadlineStatus(r.item).code !== 'expired'))
    if (ui.tab === 'المحفوظات') {
      const have = new Set(rows.map((r) => r.item.id))
      rows = Object.keys(state.saved).filter((id) => state.saved[id]).map((id) => rows.find((r) => r.item.id === id) || { item: itemById(id), reasons: [], rank: 0 }).filter((r) => r.item && (have.has(r.item.id) || r.item))
    } else if (byTab[ui.tab]) rows = rows.filter(byTab[ui.tab])
    else rows = rows.filter((r) => r.item.type !== 'مؤتمر' || ui.tab === 'لك')
    if (ui.tab === 'لك') rows = rows.filter((r) => isFresh(r.item) || state.saved[r.item.id] || state.links[r.item.id])
    if (ui.tab === 'مؤتمرات وفرص') {
      rows = rows.filter((r) => deadlineStatus(r.item).code !== 'expired')
      if (ui.onlyConfirmed) rows = rows.filter((r) => r.item.deadline)
    }
    rows = rows.filter((r) => filterWorld(r))
    const sort = ui.sort
    if (ui.tab === 'مؤتمرات وفرص' && sort === 'rank') rows.sort((a, b) => String(a.item.deadline || '9999').localeCompare(String(b.item.deadline || '9999')) || b.rank - a.rank)
    else if (sort === 'date' || ui.tab === 'الأحدث') rows.sort((a, b) => String(approxDate(b.item) || '').localeCompare(String(approxDate(a.item) || '')))
    else if (sort === 'deadline') rows.sort((a, b) => String(a.item.deadline || '9999').localeCompare(String(b.item.deadline || '9999')))
    else rows.sort((a, b) => b.rank - a.rank)
    return rows
  }
  function filterWorld(r) {
    const x = r.item; const f = ui.filters
    if (ui.q && !clean([x.title, x.description, x.source, x.keywords, state.notes[x.id]].join(' ')).includes(clean(ui.q))) return false
    if (f.type && x.type !== f.type) return false
    if (f.source && x.source !== f.source) return false
    if (f.language && x.language !== f.language) return false
    if (f.read === 'yes' && !state.read[x.id]) return false
    if (f.read === 'no' && state.read[x.id]) return false
    if (f.period && (!x.published || Date.now() - new Date(x.published) > Number(f.period) * 864e5)) return false
    return true
  }

  // ---------- العرض ----------
  function render() {
    const world = ui.space === 'world'
    root.querySelectorAll('[data-space]').forEach((x) => { x.classList.toggle('active', x.dataset.space === ui.space); x.setAttribute('aria-current', x.dataset.space === ui.space ? 'page' : 'false') })
    $('#eyebrow').textContent = world ? 'متابعة العالم' : 'متابعة العمل'
    $('#pageTitle').textContent = world ? 'العالم، بوضوح أكثر.' : 'شغلي، في مكان واحد.'
    $('#subtitle').textContent = world ? 'أبحاث ومقالات ومؤتمرات مرتبطة باهتماماتك، مع سبب ظهور كل مادة.' : 'أبحاثك ومشاريعك ومهامك ومواعيدك، وما يحتاج إجراءً الآن.'
    $('#refreshBtn').hidden = !world
    renderTabs(); renderSortSelect(); renderToolbar()
    const list = $('#list'); list.replaceChildren(); const notice = $('#notice'); notice.replaceChildren()
    if (world) renderWorld(list, notice); else renderWork(list, notice)
    renderAside(); renderBanner()
  }

  function renderTabs() {
    const tabs = $('#tabs'); const world = ui.space === 'world'
    const names = world ? WORLD_TABS : WORK_TABS.map((t) => t[0]); const current = world ? ui.tab : ui.workTab
    tabs.replaceChildren(...names.map((name) => {
      const b = el('button', 'tab' + (name === current ? ' active' : ''), name, { role: 'tab', 'aria-selected': String(name === current), tabindex: name === current ? '0' : '-1' })
      b.onclick = () => { if (world) { ui.tab = name; ui.missed = false; ui.five = false; ui.onlyConfirmed = false } else ui.workTab = name; ui.visible = 12; ui.q = ''; $('#search').value = ''; ui.sort = world ? 'rank' : 'default'; render() }
      b.onkeydown = (e) => { const all = [...tabs.children]; const i = all.indexOf(b); const n = e.key === 'ArrowLeft' ? all[i + 1] : e.key === 'ArrowRight' ? all[i - 1] : null; if (n) { e.preventDefault(); n.focus(); n.click(); tabs.children[all.indexOf(n)]?.focus() } }
      return b
    }))
  }
  function renderSortSelect() {
    const s = $('#sortSel'); s.replaceChildren()
    const opts = ui.space === 'world' ? Object.entries(WORLD_SORTS) : Object.entries(WORK_SORTS).map(([k, v]) => [k, v[0]])
    for (const [k, label] of opts) s.append(new Option(label, k))
    s.value = opts.some(([k]) => k === ui.sort) ? ui.sort : opts[0][0]
    s.onchange = () => { ui.sort = s.value; render() }
    s.parentElement.hidden = ui.space === 'work' && ui.workTab === 'ملخص'
  }

  function renderToolbar() {
    const bar = $('#toolbar'); bar.replaceChildren(); const world = ui.space === 'world'
    if (world) {
      bar.append(button('شنو فاتني؟', () => { ui.missed = !ui.missed; ui.five = false; ui.visible = 12; render() }, 'chip' + (ui.missed ? ' active' : ''), { 'aria-pressed': String(ui.missed) }))
      bar.append(button('وضع خمس دقائق', () => { ui.five = !ui.five; ui.missed = false; render() }, 'chip' + (ui.five ? ' active' : ''), { 'aria-pressed': String(ui.five) }))
      if (ui.tab === 'مؤتمرات وفرص') bar.append(button('ذات موعد مؤكد فقط', () => { ui.onlyConfirmed = !ui.onlyConfirmed; render() }, 'chip' + (ui.onlyConfirmed ? ' active' : ''), { 'aria-pressed': String(ui.onlyConfirmed) }))
    } else if (ui.workTab !== 'ملخص') {
      const key = WORK_TABS.find((t) => t[0] === ui.workTab)[1]
      bar.append(button('+ إضافة ' + NAMES[key], () => openForm(key), 'btn primary small'))
    } else {
      for (const [label, key] of [['+ مهمة', 'tasks'], ['+ فكرة', 'ideas'], ['+ موعد', 'appointments'], ['+ مشروع', 'projects']]) bar.append(button(label, () => openForm(key), 'chip'))
    }
    if (Object.values(ui.filters).some(Boolean)) bar.append(button('مسح الفلاتر', () => { ui.filters = {}; render() }, 'chip'))
    bar.append(el('span', 'count', '', { id: 'count', 'aria-live': 'polite' }))
  }
  const setCount = (t) => { const c = $('#count'); if (c) c.textContent = t }

  function noticeEl(text, tone = 'warn', action) { const n = el('div', 'notice notice-' + tone); n.append(el('span', '', text)); if (action) n.append(button(action[0], action[1], 'btn small')); return n }

  function renderWorld(list, notice) {
    $('#sectionLabel').textContent = ui.five ? 'خطتك لخمس دقائق' : ui.missed ? 'منذ آخر زيارة' : ({ 'لك': 'الأنسب لاهتماماتك', 'الأحدث': 'الأحدث', 'الأبحاث': 'أبحاث', 'مقالات وأخبار': 'مقالات وأخبار', 'مؤتمرات وفرص': 'مؤتمرات وفرص بمواعيدها', 'المحفوظات': 'محفوظاتي' })[ui.tab]
    if (!feed.loaded) { list.append(el('div', 'empty', 'جارٍ قراءة المصادر…', { role: 'status' })); setCount(''); return }
    if (!feed.meta && !feed.error) notice.append(noticeEl('لم يعمل الجالب الدوري بعد، فلا مواد حية. سيظهر المحتوى بعد أول تشغيل ناجح لمهمة «جلب مصادر مِحور» في GitHub Actions.', 'warn'))
    const failing = (feed.meta?.sources || []).filter((s) => !s.ok && !s.optional)
    if (failing.length) notice.append(noticeEl(`تعذر تحديث ${failing.length} من المصادر (${failing.map((s) => s.name).join('، ')}). ما سبق يبقى معروضاً. التفاصيل في الإعدادات ← المصادر.`, 'warn', ['التفاصيل', () => settings('sources')]))
    if (ui.tab === 'مؤتمرات وفرص') notice.append(noticeEl('المؤتمرات من WikiCFP (محتوى يضيفه منظمو الفعاليات) وقاعدة ccf-deadlines. تحقق دائماً من الرابط الرسمي قبل التقديم. لا يوجد مصدر موثوق مرتبط للمنح والزمالات والوظائف الأكاديمية؛ أضفها يدوياً من «شغلي ← مؤتمرات وفرص».', 'info', ['+ إضافة فرصة يدوياً', () => { ui.space = 'work'; ui.workTab = 'مؤتمرات وفرص'; render(); openForm('conferences') }]))
    if (ui.five) return renderFive(list, notice)
    if (ui.missed) return renderMissed(list, notice)
    const rows = worldList()
    setCount('المواد: ' + rows.length)
    rows.slice(0, ui.visible).forEach((r) => list.append(worldRow(r)))
    if (rows.length > ui.visible) list.append(button('تحميل المزيد (' + (rows.length - ui.visible) + ')', () => { ui.visible += 12; render() }, 'btn more'))
    if (!rows.length) {
      const hasFeed = feed.items.length > 0
      list.append(empty(ui.tab === 'المحفوظات' ? 'لا محفوظات بعد' : 'لا مواد مطابقة', ui.tab === 'المحفوظات' ? 'احفظ أي مادة تهمك لتجدها هنا حتى لو غادرت الموجز.' : hasFeed ? 'لا شيء يطابق اهتماماتك والفلاتر الحالية. وسّع الاهتمامات أو امسح الفلاتر.' : 'لا مواد محمّلة. اضغط «تحديث المصادر» لقراءة آخر ما جُلب.', hasFeed ? button('تعديل الاهتمامات', () => settings('interests')) : null))
    }
  }

  function renderMissed(list, notice) {
    const d = buildDigest(state, feed.items, previousVisit)
    const intro = el('div', 'digest')
    intro.append(el('h3', '', d.since ? 'منذ آخر زيارة في ' + fmtDateTime(d.since) : 'ملخص ما يستحق النظر'))
    const stats = el('div', 'digest-stats')
    for (const [n, l] of [[d.counts.fresh, 'مواد جديدة ذات صلة'], [d.counts.research, 'منها أبحاث'], [d.urgentOpps.length, 'فرص تنتهي قريباً'], [d.counts.actions, 'التزامات تحتاج إجراءً']]) { const s = el('div', 'stat'); s.append(el('strong', '', String(n)), el('span', '', l)); stats.append(s) }
    intro.append(stats)
    const groups = []
    if (d.tasksOverdue.length) groups.push(['متأخر', d.tasksOverdue.map((t) => [t.title + ' · موعده ' + fmtDate(t.deadline), () => openWork(t, 'tasks')])])
    if (d.tasksSoon.length) groups.push(['مهام هذا الأسبوع', d.tasksSoon.map((t) => [t.title + ' · ' + fmtDate(t.deadline), () => openWork(t, 'tasks')])])
    if (d.trackedDeadlines.length) groups.push(['مواعيد تقديم تتابعها', d.trackedDeadlines.map((c) => [c.title + ' · ' + fmtDate(c.deadline), () => openWork(c, 'conferences')])])
    if (d.urgentOpps.length) groups.push(['مؤتمرات تنتهي مواعيدها قريباً', d.urgentOpps.slice(0, 5).map((x) => [x.i.title + ' · ' + x.d.label, () => openItem(x.i)])])
    if (d.appointments.length) groups.push(['مواعيد قريبة', d.appointments.map((a) => [a.title + ' · ' + fmtDate(a.date), () => openWork(a, 'appointments')])])
    if (d.projectNews.length) groups.push(['جديد يخص مشاريعك', d.projectNews.flatMap((p) => p.items.map((i) => [p.project.title + ': ' + i.title, () => openItem(i)]))])
    for (const [title, rows] of groups) { const g = el('div', 'digest-group'); g.append(el('h4', '', title)); for (const [t, fn] of rows) g.append(button(t, fn, 'linkish')); intro.append(g) }
    if (!groups.length && !d.fresh.length) intro.append(el('p', 'detail-meta', 'لا شيء جديد يستحق الانتباه منذ آخر زيارة. هذا خبر جيد.'))
    notice.append(intro)
    const rows = d.fresh.filter(filterWorld)
    setCount('مواد جديدة: ' + rows.length)
    rows.slice(0, ui.visible).forEach((r) => list.append(worldRow(r)))
    if (rows.length > ui.visible) list.append(button('تحميل المزيد', () => { ui.visible += 12; render() }, 'btn more'))
    if (rows.length) notice.append(button('اعتبار الظاهر مقروءاً وبدء صفحة جديدة', () => { mutate(() => { for (const r of d.fresh) state.read[r.item.id] = nowIso(); state.lastReview = nowIso() }); previousVisit = state.lastReview; toast('رُتّبت الصفحة من جديد.') }, 'btn small'))
    else if (!d.fresh.length) list.append(empty('لا مواد جديدة', 'عُد بعد التحديث القادم للمصادر.'))
  }

  function renderFive(list, notice) {
    const plan = fiveMinutePlan(state, feed.items)
    setCount('')
    if (!plan.steps.length) { list.append(empty('لا شيء عاجل الآن', 'لا مهام قريبة ولا مواد جديدة غير مقروءة. استمتع بالوقت، أو أضف فكرة.', button('+ فكرة', () => openForm('ideas'), 'btn primary small'))); return }
    notice.append(noticeEl(`الخطة: ${plan.steps.length} خطوات · نحو ${plan.minutes} دقائق. تبدأ بالأكثر إلحاحاً ثم أنسب ما لم تقرأه.`, 'info'))
    plan.steps.forEach((s, n) => {
      const card = el('article', 'row step'); const m = el('div', 'meta'); m.append(el('span', 'badge', (n + 1) + ' · ' + s.minutes + ' د'), el('span', '', s.why || ''))
      const open = () => (s.kind === 'item' ? openItem(s.item) : openWork(s.rec, s.kind))
      card.append(m, button(s.title, open, 'row-title'), el('p', 'desc', s.action))
      const a = el('div', 'row-actions'); a.append(button('افتح', open, 'btn small primary'))
      if (s.kind === 'item') a.append(button('تم — اعتبرها مقروءة', () => { mutate(() => { state.read[s.item.id] = nowIso() }) }, 'btn small'), button('تجاهل', () => ignoreItem(s.item), 'btn small ghost'))
      if (s.kind === 'tasks') a.append(button('أنجزتها', () => mutate(() => stamp(Object.assign(s.rec, { done: true }))), 'btn small'))
      card.append(a); list.append(card)
    })
  }

  function worldRow(r) {
    const x = r.item; const row = el('article', 'row' + (state.read[x.id] ? ' is-read' : ''))
    const m = el('div', 'meta')
    m.append(el('span', 'badge type-' + x.type, x.type || 'مادة'), el('span', '', x.source || 'مصدر غير معروف'))
    if (x.published) m.append(el('span', '', fmtDate(x.published))); else if (x.year) m.append(el('span', '', approxLabel(x)))
    if (x.type === 'مؤتمر') { m.append(chipStatus(deadlineStatus(x))); if (x.location) m.append(el('span', '', x.location)) }
    row.append(m, button(x.title || 'بلا عنوان', () => openItem(x), 'row-title', { dir: x.language === 'en' ? 'auto' : 'rtl' }))
    if (x.type === 'مؤتمر') { const bits = []; if (x.deadline) bits.push('آخر موعد: ' + fmtDate(x.deadline)); if (x.eventStart) bits.push('الانعقاد: ' + fmtDate(x.eventStart, true) + (x.eventEnd && x.eventEnd !== x.eventStart ? ' – ' + fmtDate(x.eventEnd, true) : '')); if (x.mode && x.mode !== 'غير محدد') bits.push(x.mode); if (bits.length) row.append(el('p', 'desc', bits.join(' · '))) }
    else if (x.description) row.append(el('p', 'desc', x.description.slice(0, 200) + (x.description.length > 200 ? '…' : ''), { dir: 'auto' }))
    if (r.reasons?.length) row.append(el('span', 'reason', reasonText(r.reasons)))
    const a = el('div', 'row-actions')
    a.append(button(state.saved[x.id] ? '★ محفوظة' : '☆ حفظ', () => toggleSave(x), 'btn small', { 'aria-pressed': String(!!state.saved[x.id]) }))
    a.append(button('إلى مهمة', () => openForm('tasks', null, x), 'btn small'))
    const src = link('المصدر الأصلي ↗', x.officialUrl || x.url); if (src) a.append(src)
    row.append(a); return row
  }

  function toggleSave(x) { mutate(() => { state.saved[x.id] = !state.saved[x.id]; if (state.saved[x.id]) state.pinned[x.id] = compactItem(x) }); toast(state.saved[x.id] ? 'حُفظت المادة.' : 'أُزيل الحفظ.') }
  function ignoreItem(x) { mutate(() => { state.ignored[x.id] = true }); toast('أُخفيت المادة.', { label: 'تراجع', fn: () => mutate(() => { state.ignored[x.id] = false }) }) }

  // ---------- شغلي ----------
  function workRows(key) {
    let rows = state[key].slice()
    if (ui.q) rows = rows.filter((x) => clean([x.title, x.description, x.notes, x.keywords, x.authors, x.venue, x.location, x.organization].join(' ')).includes(clean(ui.q)))
    const f = ui.filters
    if (f.status) rows = rows.filter((x) => x.status === f.status)
    if (f.project) rows = rows.filter((x) => x.projectId === f.project)
    if (f.done === 'open') rows = rows.filter((x) => !x.done)
    if (f.period) rows = rows.filter((x) => { const d = daysUntil(x.deadline || x.date || ''); return d !== null && d >= 0 && d <= Number(f.period) })
    const cmp = (WORK_SORTS[ui.sort] || WORK_SORTS.default)[1]
    rows.sort(key === 'tasks' ? (a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || cmp(a, b) : cmp)
    return rows
  }

  function renderWork(list, notice) {
    const key = WORK_TABS.find((t) => t[0] === ui.workTab)[1]
    if (key === 'summary') return renderSummary(list)
    const rows = workRows(key)
    $('#sectionLabel').textContent = PLURAL[key]
    setCount('العناصر: ' + rows.length)
    if (key === 'conferences') notice.append(noticeEl('تتابع هنا مؤتمراتك وفرصك مع حالة التقديم. الموعد القريب يظهر في «شنو فاتني؟» وتستطيع تنزيل تذكير تقويم.', 'info'))
    if (!rows.length) {
      const hasAny = state[key].length > 0
      list.append(empty(hasAny ? 'لا نتائج مطابقة' : `لا توجد ${PLAIN[key]} بعد`, hasAny ? 'غيّر البحث أو امسح الفلاتر.' : ({ research: 'أضف بحثاً تعمل عليه أو تريد متابعته.', conferences: 'أضف مؤتمراً أو فرصة، أو حوّل واحدة من «العالم».', projects: 'المشروع يجمع المهام والأبحاث والمواد المرتبطة به.', tasks: 'أضف مهمة، أو حوّل مادة من العالم إلى مهمة بزر واحد.', ideas: 'سجّل فكرتك قبل أن تضيع.', achievements: 'وثّق إنجازاً: منشوراً أو محاضرة أو جائزة.', appointments: 'أضف موعداً ليظهر في خطتك.' })[key], hasAny ? null : button('+ إضافة ' + NAMES[key], () => openForm(key), 'btn primary small')))
      return
    }
    rows.slice(0, ui.visible + 20).forEach((x) => list.append(workRow(x, key)))
  }

  function workRow(x, key) {
    const r = el('article', 'row' + (x.done ? ' is-done' : ''))
    const meta = el('div', 'meta'); meta.append(el('span', 'badge', x.kind || NAMES[key]))
    if (x.status) meta.append(el('span', '', x.status)); if (x.priority && key === 'tasks') meta.append(el('span', 'badge prio-' + x.priority, x.priority))
    const when = x.deadline || x.date
    if (when) { meta.append(el('span', '', (key === 'appointments' ? '' : 'الموعد: ') + fmtDate(when) + (x.time ? ' · ' + x.time : ''))); if (!x.done && key !== 'achievements') { const st = deadlineStatus({ deadline: when }); if (['urgent', 'expired'].includes(st.code) && !(key === 'conferences' && ['قُدِّم', 'قُبل', 'رُفض', 'تخطيت'].includes(x.status))) meta.append(chipStatus(st)) } }
    const proj = x.projectId && state.projects.find((p) => p.id === x.projectId); if (proj) meta.append(el('span', 'badge', 'مشروع: ' + proj.title))
    r.append(meta)
    const titleRow = el('div', 'title-row')
    if (key === 'tasks') { const cb = el('input', 'check', '', { type: 'checkbox', 'aria-label': 'إنجاز المهمة: ' + x.title }); cb.checked = !!x.done; cb.onchange = () => mutate(() => stamp(Object.assign(x, { done: cb.checked }))); titleRow.append(cb) }
    titleRow.append(button(x.title, () => openWork(x, key), 'row-title')); r.append(titleRow)
    if (x.description) r.append(el('p', 'desc', x.description.slice(0, 200)))
    if (x.sourceTitle) { const from = el('span', 'reason', 'من مادة: ' + x.sourceTitle); r.append(from) }
    return r
  }

  function renderSummary(list) {
    $('#sectionLabel').textContent = 'ما يحتاج انتباهك'
    const today = []
    for (const t of state.tasks.filter((t) => !t.done && t.deadline && daysUntil(t.deadline) !== null && daysUntil(t.deadline) <= 7)) today.push([t.deadline, 'مهمة', t, 'tasks'])
    for (const c of state.conferences.filter((c) => c.deadline && !['قُدِّم', 'قُبل', 'رُفض', 'تخطيت'].includes(c.status) && daysUntil(c.deadline) !== null && daysUntil(c.deadline) <= 21)) today.push([c.deadline, 'موعد تقديم', c, 'conferences'])
    for (const a of state.appointments.filter((a) => a.date && daysUntil(a.date) !== null && daysUntil(a.date) >= 0 && daysUntil(a.date) <= 7)) today.push([a.date, 'موعد', a, 'appointments'])
    for (const r of state.research.filter((r) => r.deadline && daysUntil(r.deadline) !== null && daysUntil(r.deadline) <= 21)) today.push([r.deadline, 'بحث', r, 'research'])
    today.sort((a, b) => a[0].localeCompare(b[0]))
    setCount('')
    if (today.length) for (const [when, label, rec, key] of today.slice(0, 12)) { const r = workRow(rec, key); r.querySelector('.meta').prepend(el('span', 'badge', label)); list.append(r) }
    else list.append(empty('لا شيء عاجل خلال الأسبوع', 'مواعيدك ومهامك القريبة تظهر هنا. أضف مهمة أو موعداً.', button('+ مهمة', () => openForm('tasks'), 'btn primary small')))
    const active = state.projects.filter((p) => !['مكتمل', 'مؤرشف'].includes(p.status))
    if (active.length) { const wrap = el('div', 'row'); wrap.append(el('strong', '', 'مشاريعك النشطة')); const g = el('div', 'chips'); active.forEach((p) => g.append(button(p.title + ' · ' + linkedCount(p), () => openWork(p, 'projects'), 'chip'))); wrap.append(g); list.append(wrap) }
  }
  const linkedCount = (p) => state.tasks.filter((t) => t.projectId === p.id && !t.done).length + ' مهام مفتوحة'

  function renderAside() {
    const a = $('#aside'); a.replaceChildren(); const world = ui.space === 'world'
    const c = el('div', 'aside-card'); c.append(el('h3', '', 'لمحة اليوم'))
    if (world) { const ranked = rankFeed(feed.items, state); const unread = ranked.filter((r) => !state.read[r.item.id] && !state.ignored[r.item.id] && isFresh(r.item)); c.append(el('div', 'big', String(unread.length)), el('p', '', 'مادة حديثة ذات صلة لم تُقرأ')) }
    else { c.append(el('div', 'big', String(state.tasks.filter((t) => !t.done).length)), el('p', '', 'مهام مفتوحة')) }
    a.append(c)
    const next = nextDeadlines().slice(0, 3)
    const d = el('div', 'aside-card'); d.append(el('h3', '', 'أقرب المواعيد'))
    if (next.length) next.forEach((n) => { const b = button(n.title, n.open, 'linkish'); const w = el('div', 'dl-line'); w.append(b, chipStatus(deadlineStatus({ deadline: n.date }))); d.append(w) }); else d.append(el('p', '', 'لا مواعيد قادمة مسجلة.'))
    a.append(d)
    const s = el('div', 'aside-card'); s.append(el('h3', '', 'آخر تحديث ناجح للمصادر'))
    const ok = (feed.meta?.sources || []).filter((x) => x.ok); const bad = (feed.meta?.sources || []).filter((x) => !x.ok && !x.optional)
    s.append(el('p', '', feed.meta ? fmtDateTime(feed.meta.updatedAt) : 'لم يحدث بعد'))
    if (feed.meta) s.append(el('p', 'detail-meta', `${ok.length} مصادر تعمل` + (bad.length ? ` · ${bad.length} متعثرة` : '')), button('حالة المصادر', () => settings('sources'), 'linkish'))
    a.append(s)
  }
  function nextDeadlines() {
    const out = []
    for (const t of state.tasks) if (!t.done && t.deadline) out.push({ date: t.deadline, title: t.title, open: () => openWork(t, 'tasks') })
    for (const c of state.conferences) if (c.deadline && !['قُدِّم', 'قُبل', 'رُفض', 'تخطيت'].includes(c.status)) out.push({ date: c.deadline, title: c.title, open: () => openWork(c, 'conferences') })
    for (const p of state.appointments) if (p.date) out.push({ date: p.date, title: p.title, open: () => openWork(p, 'appointments') })
    return out.filter((x) => (daysUntil(x.date) ?? -1) >= 0).sort((a, b) => a.date.localeCompare(b.date))
  }

  // ---------- تفاصيل مادة ----------
  function openItem(x) {
    if (!state.read[x.id]) mutate(() => { state.read[x.id] = nowIso() })
    const body = el('div')
    const reasons = scoreItem(x, activeInterests(), state.projects).reasons
    body.append(el('p', 'detail-meta', [x.source, x.published ? 'نُشر: ' + fmtDate(x.published) : x.year ? 'النشر: ' + approxLabel(x) : 'تاريخ النشر غير معلن', 'جُلب: ' + fmtDate(x.fetched), x.venue].filter(Boolean).join(' · ')))
    if (x.type === 'مؤتمر') {
      const st = deadlineStatus(x); const t = el('div', 'kv')
      for (const [k, v] of [['آخر موعد للتقديم', x.deadline ? fmtDate(x.deadline) : 'غير مؤكد — راجع الرابط الرسمي'], ['الحالة', st.label], ['الانعقاد', x.eventStart ? fmtDate(x.eventStart) + (x.eventEnd && x.eventEnd !== x.eventStart ? ' – ' + fmtDate(x.eventEnd) : '') : 'غير معلن'], ['المكان', x.location || 'غير معلن'], ['نمط المشاركة', x.mode || 'غير محدد']]) { t.append(el('dt', '', k), el('dd', '', v)) }
      if (x.deadlineNote) t.append(el('dt', '', 'ملاحظة'), el('dd', '', x.deadlineNote))
      body.append(t)
    }
    if (x.description) body.append(el('p', 'desc', x.description, { dir: 'auto' }))
    if (x.keywords) body.append(el('p', 'detail-meta', 'الوسوم: ' + x.keywords))
    if (reasons.length) body.append(el('p', 'reason', reasonText(reasons)))
    const links = el('div', 'detail-links'); const a = link('فتح المصدر الأصلي ↗', x.url); if (a) links.append(a); const o = x.officialUrl && x.officialUrl !== x.url ? link('الموقع الرسمي ↗', x.officialUrl) : null; if (o) links.append(o); body.append(links)
    const actions = el('div', 'detail-actions')
    actions.append(button(state.saved[x.id] ? '★ إزالة الحفظ' : '☆ حفظ', () => { toggleSave(x); openItem(x) }), button('إنشاء مهمة', () => openForm('tasks', null, x)), button('إنشاء فكرة', () => openForm('ideas', null, x)))
    if (x.type === 'بحث') actions.append(button('إضافة إلى أبحاثي', () => openForm('research', null, x)))
    if (x.type === 'مؤتمر') { actions.append(button('متابعة في مؤتمراتي', () => openForm('conferences', null, x))); if (x.deadline) actions.append(button('تذكير تقويم (ICS)', () => downloadIcs({ id: x.id, title: 'آخر موعد: ' + x.title, date: x.deadline, url: x.officialUrl || x.url, description: 'تحقق من الرابط الرسمي.' }))) }
    actions.append(button('إخفاء المادة', () => { ignoreItem(x); closeDrawer() }, 'btn small ghost'))
    body.append(actions)
    const label = el('label', 'field', 'ملاحظتي'); const ta = el('textarea'); ta.value = state.notes[x.id] || ''
    ta.onchange = () => { mutate(() => { state.notes[x.id] = ta.value; state.pinned[x.id] = compactItem(x) }); toast('حُفظت الملاحظة.') }; label.append(ta); body.append(label)
    const rel = el('label', 'field', 'ربط بمشروع'); const sel = el('select'); sel.append(new Option('بلا ربط', '')); state.projects.forEach((p) => sel.append(new Option(p.title, p.id))); sel.value = state.links[x.id] || ''
    sel.onchange = () => { mutate(() => { state.links[x.id] = sel.value; if (sel.value) state.pinned[x.id] = compactItem(x) }) }; rel.append(sel); body.append(rel)
    if (!state.projects.length) body.append(button('+ إنشاء مشروع للربط', () => openForm('projects'), 'btn small'))
    openDrawer(x.title, body)
  }

  // ---------- نماذج وتفاصيل العمل ----------
  function openForm(key, record = null, source = null) {
    const form = el('form'); const vals = { ...(record || {}) }
    if (source && !record) {
      vals.title = key === 'tasks' ? 'متابعة: ' + source.title : key === 'ideas' ? 'فكرة من: ' + source.title : source.title
      if (key === 'research') { vals.venue = source.venue || ''; vals.url = source.url; vals.year = source.year || (source.published || '').slice(0, 4); vals.keywords = source.keywords || ''; vals.status = 'فكرة' }
      if (key === 'conferences') { Object.assign(vals, { url: source.officialUrl || source.url, deadline: source.deadline || '', eventDate: source.eventStart || '', location: source.location || '', mode: source.mode || 'غير محدد', status: 'قيد الدراسة', kind: 'مؤتمر' }) }
      if (key === 'tasks' && source.deadline) vals.deadline = source.deadline
    }
    for (const [id, label, type, required] of FIELDS[key]) {
      const wrap = el('label', 'field', label); let input
      if (type === 'textarea') input = el('textarea'); else if (type === 'select') { input = el('select'); for (const o of SELECTS[id](key)) input.append(new Option(o, o)) } else { input = el('input'); input.type = type === 'url' ? 'url' : type || 'text' }
      input.name = id; if (type !== 'select') input.value = vals[id] || ''; else input.value = vals[id] || SELECTS[id](key)[0] || ''
      if (id === 'title') input.setAttribute('autofocus', '')
      if (required) { input.required = true; wrap.append(' *') } wrap.append(input); form.append(wrap)
    }
    if (key !== 'projects') { const w = el('label', 'field', 'المشروع المرتبط'); const s = el('select'); s.name = 'projectId'; s.append(new Option('بلا ربط', '')); state.projects.forEach((p) => s.append(new Option(p.title, p.id))); s.value = vals.projectId || ''; w.append(s); form.append(w) }
    const err = el('p', 'form-error', '', { role: 'alert' }); form.append(err)
    const submit = el('button', 'btn primary', record ? 'حفظ التعديلات' : 'إضافة', { type: 'submit' }); form.append(submit)
    form.onsubmit = (e) => {
      e.preventDefault(); const data = Object.fromEntries(new FormData(form)); err.textContent = ''
      if (!String(data.title || '').trim()) { err.textContent = 'العنوان مطلوب.'; return }
      if (data.url && !safeUrl(data.url)) { err.textContent = 'الرابط يجب أن يبدأ بـ http أو https.'; return }
      if (data.deadline && data.start && data.deadline < data.start) { err.textContent = 'الموعد المستهدف قبل تاريخ البداية.'; return }
      const rec = { ...(record || {}), ...data, id: record?.id || newId(), updated: nowIso() }
      if (!rec.projectId) delete rec.projectId
      if (source && !record) { rec.sourceId = source.id; rec.sourceUrl = source.url; rec.sourceTitle = source.title; rec.sourceDate = source.published }
      mutate(() => { const arr = state[key]; const i = arr.findIndex((x) => x.id === rec.id); if (i >= 0) arr[i] = rec; else arr.unshift(rec); delete state.tombstones[rec.id]; if (source && !record) state.pinned[source.id] = compactItem(source) })
      closeDrawer(); toast(record ? 'حُفظت التعديلات.' : 'أُضيف ' + NAMES[key] + '.')
    }
    openDrawer((record ? 'تعديل ' : 'إضافة ') + NAMES[key], form)
  }

  function openWork(x, key) {
    const body = el('div'); body.append(el('p', 'detail-meta', [x.kind, x.status, x.priority && 'الأولوية: ' + x.priority, (x.deadline || x.date) && 'الموعد: ' + fmtDate(x.deadline || x.date) + (x.time ? ' · ' + x.time : '')].filter(Boolean).join(' · ')))
    const facts = el('dl', 'kv'); for (const [k, l] of [['authors', 'المؤلفون'], ['venue', 'الجهة'], ['organization', 'الجهة'], ['location', 'المكان'], ['mode', 'النمط'], ['fees', 'الرسوم'], ['eventDate', 'موعد الفعالية'], ['year', 'السنة'], ['start', 'البداية']]) if (x[k]) { facts.append(el('dt', '', l), el('dd', '', k === 'eventDate' || k === 'start' ? fmtDate(x[k]) : x[k])) } if (facts.children.length) body.append(facts)
    if (x.description) body.append(el('p', 'desc', x.description)); if (x.notes) body.append(el('p', 'desc', x.notes)); if (x.keywords) body.append(el('p', 'detail-meta', 'الكلمات: ' + x.keywords))
    const links = el('div', 'detail-links'); for (const [u, t] of [[x.url, 'الرابط ↗'], [x.sourceUrl, 'المادة الأصلية ↗']]) { const a = link(t, u); if (a) links.append(a) } if (links.children.length) body.append(links)
    if (x.sourceId && itemById(x.sourceId)) body.append(button('فتح المادة التي أُنشئ منها', () => openItem(itemById(x.sourceId)), 'linkish'))
    if (key === 'conferences' && x.deadline) body.append(button('تذكير تقويم (ICS)', () => downloadIcs({ id: x.id, title: 'آخر موعد: ' + x.title, date: x.deadline, url: x.url }), 'btn small'))
    if (key === 'appointments' && x.date) body.append(button('إضافة إلى التقويم (ICS)', () => downloadIcs({ id: x.id, title: x.title, date: x.date, description: x.notes || '', alarms: [1] }), 'btn small'))
    if (key === 'projects') {
      body.append(el('div', 'divider'), el('h3', '', 'مرتبط بالمشروع'))
      let any = false
      for (const k of COLLECTIONS.filter((c) => c !== 'projects')) { const linked = state[k].filter((r) => r.projectId === x.id); if (!linked.length) continue; any = true; const g = el('div', 'digest-group'); g.append(el('h4', '', PLURAL[k])); linked.forEach((r) => g.append(button((r.done ? '✓ ' : '') + r.title, () => openWork(r, k), 'linkish'))); body.append(g) }
      const items = Object.keys(state.links).filter((id) => state.links[id] === x.id).map(itemById).filter(Boolean)
      if (items.length) { any = true; const g = el('div', 'digest-group'); g.append(el('h4', '', 'مواد من العالم')); items.forEach((i) => g.append(button(i.title, () => openItem(i), 'linkish'))); body.append(g) }
      if (!any) body.append(el('p', 'detail-meta', 'لا عناصر مرتبطة بعد. اربط مهمة أو بحثاً أو مادة بهذا المشروع.'))
      const fresh = rankFeed(feed.items, { ...state, projects: [x] }).filter((r) => r.reasons.some((z) => z.project === x.id)).slice(0, 5)
      body.append(el('h3', '', 'مستجدات تطابق كلمات المشروع'))
      if (!fresh.length) body.append(el('p', 'detail-meta', x.keywords ? 'لا مواد حالية تطابق الكلمات.' : 'أضف كلمات واضحة (عبارات) للمشروع لتظهر المستجدات هنا.')); fresh.forEach((r) => body.append(button(r.item.title, () => openItem(r.item), 'linkish')))
    }
    const actions = el('div', 'detail-actions')
    if (key === 'tasks') actions.append(button(x.done ? 'إعادة فتح' : '✓ إنجاز', () => { mutate(() => stamp(Object.assign(x, { done: !x.done }))); closeDrawer() }))
    actions.append(button('تعديل', () => openForm(key, x)), button('حذف', () => deleteRecord(x, key), 'btn small danger')); body.append(actions)
    openDrawer(x.title, body)
  }

  function deleteRecord(x, key) {
    const snapshot = { ...x }
    mutate(() => { state[key] = state[key].filter((v) => v.id !== x.id); state.tombstones[x.id] = nowIso() })
    closeDrawer()
    toast('حُذف العنصر.', { label: 'تراجع', fn: () => mutate(() => { delete state.tombstones[snapshot.id]; state[key].unshift(Object.assign(snapshot, { updated: nowIso() })) }) })
  }

  function downloadIcs(ev) { download(new Blob([buildIcs(ev)], { type: 'text/calendar' }), 'mihwar-reminder.ics') }
  function download(blob, name) { const a = document.createElement('a'); const u = URL.createObjectURL(blob); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1500) }

  // ---------- الفلاتر والبحث الشامل ----------
  function filtersDrawer() {
    const body = el('div', 'filter-grid'); const world = ui.space === 'world'
    const specs = world ? [['type', 'النوع', ['بحث', 'مقال', 'خبر', 'مؤتمر']], ['language', 'اللغة', ['ar', 'en']], ['read', 'القراءة', ['yes', 'no']], ['period', 'خلال أيام', ['7', '30', '90', '365']]] : [['status', 'الحالة', [...new Set([...APPLICATION_STATUSES, ...Object.values(STATUS).flat()])]], ['project', 'المشروع', state.projects.map((p) => p.id)], ['done', 'المهام', ['open']], ['period', 'موعد خلال أيام', ['7', '30', '90']]]
    for (const [key, label, opts] of specs) { const w = el('label', 'field', label); const s = el('select'); s.append(new Option('الكل', '')); opts.forEach((o) => s.append(new Option(({ yes: 'مقروءة', no: 'غير مقروءة', ar: 'العربية', en: 'الإنجليزية', open: 'المفتوحة فقط' })[o] || (key === 'project' ? state.projects.find((p) => p.id === o)?.title : o), o))); s.value = ui.filters[key] || ''; s.onchange = () => { ui.filters[key] = s.value; render() }; w.append(s); body.append(w) }
    if (world) { const sources = [...new Set(feed.items.map((x) => x.source).filter(Boolean))].sort(); const w = el('label', 'field', 'المصدر'); const s = el('select'); s.append(new Option('الكل', '')); sources.forEach((o) => s.append(new Option(o, o))); s.value = ui.filters.source || ''; s.onchange = () => { ui.filters.source = s.value; render() }; w.append(s); body.append(w) }
    body.append(button('مسح الكل وإغلاق', () => { ui.filters = {}; render(); closeDrawer() }, 'btn'))
    openDrawer('الفلاتر', body)
  }

  function globalSearch() {
    const body = el('div'); const input = el('input', 'big-input', '', { type: 'search', placeholder: 'ابحث في كل شيء: المواد والأبحاث والمهام والملاحظات…', 'aria-label': 'بحث شامل' }); const result = el('div', 'results', '', { role: 'region', 'aria-live': 'polite' })
    const update = () => {
      result.replaceChildren(); const term = clean(input.value); if (term.length < 2) return
      const all = [...feed.items.map((x) => ({ x, label: 'مادة', open: () => openItem(x), hay: [x.title, x.description, x.source, x.keywords, state.notes[x.id]] })), ...Object.keys(state.pinned).filter((id) => !feed.items.some((i) => i.id === id)).map((id) => ({ x: state.pinned[id], label: 'محفوظة', open: () => openItem(state.pinned[id]), hay: [state.pinned[id].title, state.notes[id]] })), ...COLLECTIONS.flatMap((k) => state[k].map((x) => ({ x, label: NAMES[k], open: () => openWork(x, k), hay: [x.title, x.description, x.notes, x.keywords, x.authors] })))]
      const hits = all.filter((r) => clean(r.hay.join(' ')).includes(term)).slice(0, 30)
      hits.forEach((r) => { const b = button(r.label + ' · ' + r.x.title, r.open, 'row-title res'); result.append(b) }); if (!hits.length) result.append(empty('لا نتائج', 'جرّب كلمة أخرى.'))
    }
    input.oninput = update; body.append(input, result); openDrawer('بحث شامل', body); input.focus()
  }

  // ---------- الإعدادات ----------
  function settings(section) {
    const body = el('div', 'settings')
    const sec = (id, title) => { const d = el('details', 'sec', '', { id: 'sec-' + id }); d.open = !section || section === id; d.append(el('summary', '', title)); body.append(d); return d }
    // الاهتمامات
    const si = sec('interests', 'الاهتمامات')
    si.append(el('p', 'detail-meta', 'مستخرجة من موقعك (السيرة، الأبحاث، الكتب، المقالات والخريطة الفكرية). تحكم بما يظهر: كل عبارة في سطر؛ «أ + ب» يعني ظهور الطرفين معاً؛ كلمة مفردة مميزة تبدأ بـ ! (مثل !gamification). كلمة عامة وحدها (مثل learning) لا تكفي لإظهار مادة.'))
    state.interests.forEach((i, n) => {
      const row = el('div', 'int-row'); const hits = feed.items.filter((m) => scoreItem(m, [i]).relevant).length
      const t = el('div'); t.append(el('strong', '', i.name), el('p', 'detail-meta', (i.source || '') + ' · ' + (i.phrases || []).length + ' عبارة · ' + hits + ' مادة حالية'))
      row.append(t, button(i.active === false ? 'تفعيل' : 'إيقاف', () => { mutate(() => { i.active = i.active === false }); settings('interests') }, 'btn small', { 'aria-pressed': String(i.active !== false) }), button('تعديل', () => interestForm(n), 'btn small')); si.append(row)
    })
    si.append(button('+ اهتمام جديد', () => interestForm(-1), 'btn primary small'), button('استعادة الاهتمامات الافتراضية', () => { if (confirm('استبدال اهتماماتك بالافتراضية؟ (لن تُمسّ بقية بياناتك)')) { mutate(() => { state.interests = DEFAULT_INTERESTS.map((i) => ({ ...i })) }); settings('interests') } }, 'btn small ghost'))
    // المصادر
    const ss = sec('sources', 'المصادر وحالتها')
    if (!feed.meta) ss.append(el('p', 'detail-meta', feed.error ? 'تعذرت قراءة حالة المصادر.' : 'لم يعمل الجالب الدوري بعد.'))
    else {
      ss.append(el('p', 'detail-meta', 'آخر تحديث مكتمل: ' + fmtDateTime(feed.meta.updatedAt) + ' · يعمل الجالب تلقائياً كل ست ساعات. يمكنك إخفاء أي مصدر من عرضك.'))
      for (const s of feed.meta.sources) {
        const row = el('div', 'src-row' + (s.ok ? '' : ' src-bad')); const t = el('div')
        t.append(el('strong', '', (s.ok ? '✓ ' : '✗ ') + s.name), el('p', 'detail-meta', ['مقبول ' + s.kept, s.ok ? 'آخر نجاح ' + fmtDateTime(s.lastSuccess) : 'آخر نجاح: ' + (s.lastSuccess ? fmtDateTime(s.lastSuccess) : 'لم يسبق'), s.licence].join(' · ')))
        if (s.error) t.append(el('p', 'src-error', s.error))
        row.append(t, button(state.sourcesOff[s.id] ? 'إظهار' : 'إخفاء', () => { mutate(() => { state.sourcesOff[s.id] = !state.sourcesOff[s.id] }); settings('sources') }, 'btn small')); ss.append(row)
      }
    }
    ss.append(button('إعادة قراءة المصادر الآن', () => loadFeed(true), 'btn small'))
    // المزامنة
    const sy = sec('sync', 'المزامنة والخصوصية')
    sy.append(el('p', 'detail-meta', 'بياناتك الخاصة تُحفظ في مستند باسم حسابك فقط، وقواعد قاعدة البيانات ترفض أي قراءة أو كتابة من غيرك. الصفحة غير مفهرسة. عند انقطاع الاتصال تُحفظ التغييرات على جهازك مؤقتاً، وعند تعارض بين جهازين تُدمج دون فقد أي عنصر.'), el('p', 'detail-meta', 'الحالة: ' + (sync.status === 'saved' ? 'محفوظ · ' + fmtDateTime(sync.at) : sync.message || sync.status)), button('حفظ الآن', retryNow, 'btn small'))
    // النسخ
    const sb = sec('backup', 'النسخ الاحتياطي والاستيراد')
    sb.append(el('p', 'detail-meta', 'تؤخذ نسخة سحابية يومية تلقائية، وقبل أي استيراد أو استعادة. تُحفظ آخر 12 نسخة.'))
    const row = el('div', 'detail-actions'); row.append(button('تصدير JSON', () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'mihwar-backup-' + nowIso().slice(0, 10) + '.json')), button('تصدير CSV', exportCsv), button('نسخة سحابية الآن', async () => { try { await bridge.createBackup(state, 'يدوية'); state.lastBackup = nowIso(); touchQuiet(); toast('حُفظت نسخة سحابية.'); settings('backup') } catch { toast('تعذر إنشاء النسخة.') } })); sb.append(row)
    const lab = el('label', 'field', 'استيراد نسخة JSON'); const inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.onchange = () => importFile(inp.files[0]); lab.append(inp); sb.append(lab)
    const listBox = el('div', 'backups', 'جارٍ جلب النسخ السحابية…'); sb.append(el('h4', '', 'النسخ السحابية'), listBox)
    bridge.listBackups().then((all) => {
      listBox.replaceChildren(); if (!all.length) listBox.append(el('p', 'detail-meta', 'لا نسخ بعد.'))
      all.forEach((b) => { const r = el('div', 'src-row'); r.append(el('span', '', fmtDateTime(b.createdAt) + ' · ' + b.reason), button('استعادة', () => restoreBackup(b), 'btn small')); listBox.append(r) })
    }).catch(() => { listBox.textContent = 'تعذر جلب النسخ (ربما لا اتصال).' })
    openDrawer('الإعدادات', body)
    if (section) body.querySelector('#sec-' + section)?.scrollIntoView?.({ block: 'start' })
  }

  function interestForm(n) {
    const x = n >= 0 ? state.interests[n] : { name: '', phrases: [], exclude: [] }; const form = el('form')
    const mk = (k, label, val, area) => { const w = el('label', 'field', label); const i = area ? el('textarea') : el('input'); i.name = k; i.value = val; if (k === 'name') i.required = true; if (area) i.rows = 7; w.append(i); form.append(w) }
    mk('name', 'الموضوع', x.name); mk('phrases', 'عبارات المطابقة (كل عبارة في سطر)', (x.phrases || x.terms || []).join('\n'), true); mk('exclude', 'عبارات تستبعد المادة إن ظهرت في عنوانها', (x.exclude || []).join('\n'), true)
    const err = el('p', 'form-error', '', { role: 'alert' }); form.append(err, el('button', 'btn primary', 'حفظ', { type: 'submit' }))
    if (n >= 0 && !DEFAULT_INTERESTS.some((d) => d.id === x.id)) form.append(button('حذف الاهتمام', () => { mutate(() => state.interests.splice(n, 1)); settings('interests') }, 'btn small danger'))
    form.onsubmit = (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form)); const lines = (t) => String(t).split('\n').map((s) => s.trim()).filter(Boolean)
      const phrases = lines(v.phrases); const weak = phrases.filter((p) => !p.includes('+') && !p.startsWith('!') && !/\s/.test(p))
      if (!phrases.length) { err.textContent = 'أضف عبارة واحدة على الأقل.'; return }
      if (weak.length === phrases.length) { err.textContent = 'العبارات كلها كلمات مفردة عامة ولن تُظهر مواد (بسبب منع التطابق بكلمة واحدة). استخدم عبارة من كلمتين أو «أ + ب» أو ابدأ الكلمة المميزة بـ !'; return }
      const rec = { ...x, id: x.id || 'u_' + newId().slice(0, 8), name: v.name.trim(), phrases, exclude: lines(v.exclude), source: x.source || 'أضفته أنت', active: x.active !== false }
      mutate(() => { if (n >= 0) state.interests[n] = rec; else state.interests.push(rec) }); toast('حُفظ الاهتمام وأُعيد ترتيب الموجز.'); settings('interests')
    }
    openDrawer(n >= 0 ? 'تعديل الاهتمام' : 'اهتمام جديد', form)
  }

  function exportCsv() { const rows = toCsvRows(state, NAMES); download(new Blob(['﻿' + rows.map((r) => r.map((v) => '"' + String(v ?? '').replaceAll('"', '""').replace(/^([=+\-@])/, "'$1") + '"').join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'mihwar-work.csv') }

  async function importFile(file) {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('size')
      const data = JSON.parse(await file.text()); const v = validateBackup(data)
      if (!v.ok) { toast(v.error); return }
      const c = v.counts
      const body = el('div'); body.append(el('p', '', `ستُستبدل بياناتك الحالية بمحتوى الملف. تؤخذ نسخة سحابية من بياناتك الحالية أولاً.`), el('p', 'detail-meta', `الملف: ${c.research} أبحاث · ${c.conferences} مؤتمرات · ${c.projects} مشاريع · ${c.tasks} مهام · ${c.ideas} أفكار · ${c.achievements} إنجازات · ${c.appointments} مواعيد · ${v.saved} محفوظات`), el('p', 'detail-meta', `الحالي: ${state.research.length} أبحاث · ${state.conferences.length} مؤتمرات · ${state.projects.length} مشاريع · ${state.tasks.length} مهام`))
      const act = el('div', 'detail-actions')
      act.append(button('استبدال', async () => { try { await bridge.createBackup(state, 'قبل الاستيراد'); } catch { if (!confirm('تعذرت النسخة السحابية قبل الاستيراد. المتابعة على مسؤوليتك؟ (يُنصح بتصدير JSON أولاً)')) return } mutate(() => { state = v.state }); closeDrawer(); toast('اكتمل الاستيراد.') }, 'btn primary'), button('دمج مع الحالي', async () => { try { await bridge.createBackup(state, 'قبل الدمج') } catch { /* متابعة */ } mutate(() => { state = mergeStates(state, v.state) }); closeDrawer(); toast('دُمج الملف مع بياناتك.') }, 'btn'), button('إلغاء', closeDrawer, 'btn ghost'))
      body.append(act); openDrawer('استيراد نسخة', body)
    } catch { toast('ملف النسخة غير صالح أو كبير جداً.') }
  }

  async function restoreBackup(b) {
    try {
      const data = await bridge.readBackup(b.id); const v = validateBackup(data); if (!v.ok) { toast('النسخة تالفة: ' + v.error); return }
      if (!confirm('استعادة نسخة ' + fmtDateTime(b.createdAt) + '؟ تؤخذ نسخة من حالتك الحالية أولاً.')) return
      await bridge.createBackup(state, 'قبل استعادة نسخة'); mutate(() => { state = v.state }); closeDrawer(); toast('استُعيدت النسخة.')
    } catch { toast('تعذرت الاستعادة؛ لم يتغير شيء.') }
  }

  // ---------- ربط الأحداث ----------
  root.querySelectorAll('[data-space]').forEach((x) => { x.onclick = () => { ui.space = x.dataset.space; ui.q = ''; ui.filters = {}; ui.sort = ui.space === 'world' ? 'rank' : 'default'; ui.missed = ui.five = false; $('#search').value = ''; render() } })
  $('#search').oninput = (e) => { ui.q = e.target.value; ui.visible = 12; render() }
  $('#filterBtn').onclick = filtersDrawer; $('#settingsBtn').onclick = () => settings(); $('#settingsMobile').onclick = () => settings(); $('#globalBtn').onclick = globalSearch
  $('#refreshBtn').onclick = () => loadFeed(true); $('#closeDrawer').onclick = closeDrawer; $('#overlay').onclick = closeDrawer
  $('#quickAdd').onclick = () => { const body = el('div', 'quick'); for (const k of ['tasks', 'ideas', 'appointments', 'research', 'conferences', 'projects']) body.append(button('+ ' + NAMES[k], () => openForm(k), 'btn big-btn')); openDrawer('إضافة سريعة', body) }
  const onKey = (e) => {
    if (e.key === 'Escape') closeDrawer()
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); globalSearch() }
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(root.activeElement?.tagName) && !$('#drawer').classList.contains('show')) { e.preventDefault(); $('#search').focus() }
    trapFocus(e)
  }
  const onOnline = () => { if (dirty) { toast('عاد الاتصال، جارٍ إرسال تغييراتك…'); flush() } renderBanner() }
  const onOffline = () => setSync('offline')
  const beforeUnload = (e) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
  document.addEventListener('keydown', onKey); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('beforeunload', beforeUnload)
  root.addEventListener('keydown', trapFocus)
  setSync('loading'); render(); load()
  return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeunload', beforeUnload); clearTimeout(saveTimer); disposers.forEach((d) => { try { d() } catch { /* ignore */ } }) }
}
