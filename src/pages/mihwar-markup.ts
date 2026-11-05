export const markup = `
<div class="app" dir="rtl" lang="ar">
  <a class="skip" href="#list">تخطَّ إلى المحتوى</a>
  <aside class="side" aria-label="القائمة الرئيسية">
    <div class="brand">مِحور<small>مركز قيادتك اليومي</small></div>
    <nav class="side-nav" aria-label="المساحات">
      <button class="nav active" data-space="world" aria-current="page"><span aria-hidden="true">◎</span> العالم</button>
      <button class="nav" data-space="work"><span aria-hidden="true">▤</span> شغلي</button>
    </nav>
    <div class="side-bottom">
      <button class="nav" id="settingsBtn"><span aria-hidden="true">⚙</span> الإعدادات</button>
      <div class="privacy"><span class="status-dot" id="syncDot"></span><span id="syncText">جارٍ التحميل…</span></div>
    </div>
  </aside>
  <main class="main" id="main">
    <header class="top">
      <div>
        <p class="eyebrow" id="eyebrow">مركز المتابعة</p>
        <h1 id="pageTitle">العالم، بوضوح أكثر.</h1>
        <p class="subtitle" id="subtitle"></p>
      </div>
      <div class="top-actions">
        <button class="btn small" id="globalBtn" aria-keyshortcuts="Control+K Meta+K">بحث شامل ⌕</button>
        <button class="btn small" id="refreshBtn">تحديث المصادر</button>
        <button class="btn small" id="settingsMobile">الإعدادات</button>
      </div>
    </header>
    <div class="banner" id="banner" role="status" aria-live="polite" hidden></div>
    <div class="search-wrap" role="search">
      <input id="search" type="search" placeholder="ابحث في العناوين والمصادر والملاحظات…" aria-label="بحث سريع في هذه الصفحة">
      <button class="btn" id="filterBtn">الفلاتر</button>
      <label class="sort"><span class="sr">الترتيب</span><select id="sortSel" aria-label="الترتيب"></select></label>
    </div>
    <div class="tabs" id="tabs" role="tablist" aria-label="التبويبات"></div>
    <div class="toolbar" id="toolbar"></div>
    <div id="notice"></div>
    <div class="layout">
      <section aria-labelledby="sectionLabel">
        <p class="section-label" id="sectionLabel"></p>
        <div class="list" id="list" tabindex="-1" role="tabpanel"></div>
      </section>
      <aside class="aside" id="aside" aria-label="لمحة"></aside>
    </div>
  </main>
</div>
<nav class="mobile-nav" aria-label="التنقل السريع">
  <button data-space="world" class="active">العالم</button>
  <button data-space="work">شغلي</button>
  <button id="quickAdd">+ إضافة</button>
</nav>
<div class="overlay" id="overlay"></div>
<section class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle" aria-hidden="true">
  <div class="drawer-head"><h2 id="drawerTitle" tabindex="-1"></h2><button class="close" id="closeDrawer" aria-label="إغلاق">×</button></div>
  <div id="drawerBody"></div>
</section>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`
