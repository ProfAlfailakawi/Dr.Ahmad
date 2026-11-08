// The spec-driven experience engine. buildFromSpec(spec) returns a build(ctx) that follows the
// contract of experiences.js: it returns { update(t, dt, e) }.
//   - the intro (intros.js) plays first, 6.2 s;
//   - the template starts drawing itself near the end of the intro and already has a pulsing light;
//   - its interactive layer wakes (tpl.ready()) when the intro completes.
import { playIntro } from './intros.js';
import { BUILDERS, READY, META, loadPage } from '../v3/registry.js?v=27';
import { INTRO_T, smooth } from './common.js';
import { buildPopup } from './templates/popup.js';
import { buildHotspots } from './templates/hotspots.js';
import { buildDiagram } from './templates/diagram.js';
import { buildCycle } from './templates/cycle.js';
import { buildTimeline } from './templates/timeline.js';
import { buildCompare } from './templates/compare.js';
import { buildQuiz } from './templates/quiz.js';

// games.js is written separately; if it is not there yet only the 'game' template is affected.
let buildGame = null;
try { ({ buildGame } = await import('./games.js')); } catch (err) { console.warn('[v2] games.js not available yet', err?.message); }

const TEMPLATES = { popup: buildPopup, hotspots: buildHotspots, diagram: buildDiagram, cycle: buildCycle, timeline: buildTimeline, compare: buildCompare, quiz: buildQuiz };

export function buildFromSpec(spec) {
  return function build(ctx) {
    const intro = spec.intro ? playIntro(spec.intro.kind, spec.intro, ctx) : null;
    const shift = intro ? 0 : INTRO_T - 1.4;           // no intro: let the template start its drawing at once
    let tpl, isGame = false;
    if (spec.template === 'game') {
      isGame = true;
      tpl = buildGame ? buildGame(spec, ctx) : { update() {}, ready() { ctx.ui.card({ tag: 'لعبة', title: spec.title, body: 'هذه اللعبة قيد التجهيز.', color: 0xd4ad55 }); } };
    } else {
      const fn = TEMPLATES[spec.template];
      if (!fn) throw new Error('[v2] unknown template: ' + spec.template);
      tpl = fn(spec, ctx);
    }
    let ready = false;
    return {
      update(t, dt, e) {
        const tt = t + shift;
        if (intro) intro.update(t);
        const gate = smooth((tt - (INTRO_T - 1.2)) / 1.2);
        if (!ready && tt >= INTRO_T) { ready = true; tpl.ready?.(); }
        if (isGame) tpl.update(Math.max(0, tt - (INTRO_T - 1.2)), dt, e * gate);
        else tpl.update(tt, dt, e, gate);
      },
      introDone() { return !intro || intro.done; },
    };
  };
}

// An EXPERIENCES-style catalogue entry for a spec (so app.js can list/launch it unchanged).
const TYPE_OF = { popup: 'hotspots', hotspots: 'hotspots', diagram: 'infographic', cycle: 'animation', timeline: 'timeline', compare: 'balance', quiz: 'quiz', game: 'game' };
export function specToExperience(spec) {
  const has = READY.includes(spec.page);                       // a hand-built scene exists for this page
  const meta = (k, d) => META[spec.page]?.[k] ?? d;
  return {
    id: spec.id, kind: 'page', door: spec.door, chapter: spec.chapter, page: 'p' + spec.page, pageNo: '',
    get title() { return meta('title', spec.title); }, type: TYPE_OF[spec.template] || 'hotspots',
    get typeLabel() { return meta('typeLabel', spec.typeLabel); }, video: spec.video || null,
    get center() { return meta('center', spec.center); }, crop: spec.crop,
    get free() { return meta('free', false); }, behind: spec.behind,
    build: (ctx) => {
      if (!has) return buildFromSpec(spec)(ctx);
      const m = BUILDERS.get(spec.page);
      if (m) return m.default(ctx);
      // First time on this phone: the scene's file is fetched now (a fraction of a second); the scene starts the moment it arrives.
      let inst = null, t0 = null, dead = false;
      loadPage(spec.page).then((mod) => { if (!dead) { try { inst = mod.default(ctx); } catch (err) { console.error('[v3] p' + spec.page, err); } } });
      return { update(t, dt, e) { if (!inst) return; if (t0 === null) t0 = t; inst.update(t - t0, dt, e); }, onLost() { inst?.onLost?.(); } };
    },
  };
}
// The build function for a page that has a hand-built v3 scene (also used to replace the older hand-built showpieces).
export function v3Build(page) {
  return (ctx) => {
    const m = BUILDERS.get(page);
    if (m) return m.default(ctx);
    let inst = null, t0 = null, dead = false;
    loadPage(page).then((mod) => { if (!dead) { try { inst = mod.default(ctx); } catch (err) { console.error('[v3] p' + page, err); } } });
    return { update(t, dt, e) { if (!inst) return; if (t0 === null) t0 = t; inst.update(t - t0, dt, e); }, onLost() { inst?.onLost?.(); } };
  };
}
export { playIntro };
