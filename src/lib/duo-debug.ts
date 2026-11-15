/**
 * تشخيص ركن الودجت (iPhone Duo): يُحمَّل ديناميكياً من main.tsx فقط عند وجود ‎?duo-debug=1‎.
 * يرسم إطار الركن المحجوز (حدود حمراء شفافة، بلا التقاط للمس) ولوحة صغيرة بقيم النظام
 * توضع خارج الركن (أسفل اليسار). لا يلمس أي حالة للتطبيق ولا يكتب شيئاً في التخزين.
 */

type Win = Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }

const probe = (name: string): number => {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;padding-top:env(safe-area-inset-${name},0px)`
  document.body.appendChild(el)
  const v = parseFloat(getComputedStyle(el).paddingTop) || 0
  el.remove()
  return v
}

export function installDuoDebug() {
  if (typeof document === 'undefined' || document.getElementById('duo-debug-frame')) return
  /* معايرة حيّة على الجهاز: ?duo-debug=1&duo-w=110&duo-h=270 تُبدّل المتغيرين على documentElement (مع duo-debug فقط). */
  const q = new URLSearchParams(location.search)
  const ow = parseFloat(q.get('duo-w') || ''), oh = parseFloat(q.get('duo-h') || '')
  if (ow > 0) document.documentElement.style.setProperty('--duo-widget-w', `${ow}px`)
  if (oh > 0) document.documentElement.style.setProperty('--duo-widget-h', `${oh}px`)
  if (ow > 0) document.documentElement.style.setProperty('--duo-widget-inset', `calc(${ow}px + var(--duo-widget-gap))`)
  const frame = document.createElement('div')
  frame.id = 'duo-debug-frame'
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('data-duo-bleed', '')
  frame.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483646;pointer-events:none;box-sizing:border-box;width:var(--duo-widget-w,0px);height:var(--duo-widget-h,0px);border:2px solid rgb(220 38 38 / .9);background:rgb(220 38 38 / .12)'
  const panel = document.createElement('pre')
  panel.id = 'duo-debug-panel'
  panel.setAttribute('data-duo-bleed', '')
  panel.dir = 'ltr'
  panel.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483647;margin:0;max-width:calc(100vw - var(--duo-widget-w,0px) - 24px);padding:8px 10px;border-radius:10px;background:rgb(0 0 0 / .78);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;pointer-events:none'
  document.body.append(frame, panel)

  const render = () => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim() || '0'
    const vv = window.visualViewport
    const w = window as Win
    const w0 = parseFloat(v('--duo-widget-w'))
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
    panel.textContent = [
      `duo-widget: ${w0 > 0 ? 'ACTIVE' : 'inactive'}  override duo-w=${ow > 0 ? ow : '-'} duo-h=${oh > 0 ? oh : '-'}`,
      'send screenshot with frame; adjust duo-w/duo-h until the red frame covers the capsule',
      `--duo-widget-w ${v('--duo-widget-w')}  gap ${v('--duo-widget-gap')}  h ${v('--duo-widget-h')}`,
      `frame ${frame.offsetWidth}x${frame.offsetHeight}px (physical top-right)`,
      `safe-area t/r/b/l: ${[probe('top'), probe('right'), probe('bottom'), probe('left')].join(' / ')}`,
      `inner ${innerWidth}x${innerHeight}  visual ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} @${vv.scale.toFixed(2)}` : 'n/a'}`,
      `dir ${document.documentElement.dir || getComputedStyle(document.body).direction}  orient ${innerHeight >= innerWidth ? 'portrait' : 'landscape'}  dpr ${devicePixelRatio}`,
      `standalone ${standalone}  navigator.standalone ${String((navigator as Navigator & { standalone?: boolean }).standalone)}`,
      `Capacitor: ${w.Capacitor?.isNativePlatform?.() ? `native ${w.Capacitor.getPlatform?.() ?? '?'}` : 'web (no native bridge)'}`,
      `UA Safari/ token: ${/Safari\//.test(navigator.userAgent)}  (WKWebView app: false)  Mobile/: ${/Mobile\//.test(navigator.userAgent)}`,
      `context guess: ${w.Capacitor?.isNativePlatform?.() ? 'APP (Capacitor WKWebView)' : /Safari\//.test(navigator.userAgent) ? (standalone ? 'PWA standalone' : 'Safari tab') : 'WebView'}`,
    ].join('\n')
  }
  render()
  addEventListener('resize', render)
  addEventListener('orientationchange', render)
  window.visualViewport?.addEventListener('resize', render)
}
