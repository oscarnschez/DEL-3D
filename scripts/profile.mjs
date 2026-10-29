// Perfil de transiciones: cuenta programas WebGL compilados y el frame más largo tras cada acción.
// Uso: node scripts/profile.mjs [url]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:5173/?calidad=baja';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => {
  const w = window;
  w.__prof = { links: 0, linkMs: 0, gaps: [], long: [] };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__prof.long.push(e.duration); }).observe({ type: 'longtask', buffered: false });
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const orig = C.prototype.linkProgram;
    C.prototype.linkProgram = function (p) {
      const t = performance.now();
      const r = orig.call(this, p);
      w.__prof.links++;
      w.__prof.linkMs += performance.now() - t;
      return r;
    };
  }
  let last = performance.now();
  const loop = (t) => {
    w.__prof.gaps.push(t - last);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
await page.goto(url);
await page.waitForSelector('canvas');
await page.waitForTimeout(40000);
console.log('programas compilados al cargar:', await page.evaluate(() => window.__prof.links));
const reset = () => page.evaluate(() => { const p = window.__prof; p.links = 0; p.linkMs = 0; p.gaps = []; p.long = []; });
const read = () => page.evaluate(() => { const p = window.__prof; return { links: p.links, linkMs: Math.round(p.linkMs), maxFrame: Math.round(Math.max(0, ...p.gaps)), maxLongTask: Math.round(Math.max(0, ...p.long)) }; });
const click = (text) => page.locator('button', { hasText: text }).first().evaluate((b) => b.click());
const step = async (label, fn) => {
  await reset();
  await fn();
  await page.waitForTimeout(3000);
  console.log(label.padEnd(28), JSON.stringify(await read()));
};
await step('ENCENDER', () => click('ENCENDER MOTOR'));
const modes = (process.env.MODES ?? 'INTERIOR,COMBUSTIÓN,LUBRICACIÓN,COMBUSTIBLE,REFRIGERACIÓN,ADMISIÓN Y ESCAPE,DESPIECE,RAYOS X,TÉCNICO,VISTA TÉRMICA,EXTERIOR,COMBUSTIÓN,RAYOS X,EXTERIOR').split(',');
for (const m of modes) await step(m, () => click(m));
for (const l of ['laboratorio', 'cine', 'estudio']) await step(`iluminación: ${l}`, () => page.evaluate((x) => window.__del.useSettings.getState().set({ lighting: x }), l));
await step('etiquetas', () => page.evaluate(() => window.__del.useApp.getState().set({ labels: true })));
await step('recorrido: combustión', () => page.evaluate(() => window.__del.useApp.getState().set({ tour: 'combustion' })));
await step('cancelar recorrido', () => page.evaluate(() => window.__del.useApp.getState().set({ tour: null })));
await step('despiece por grupo: turbo', () => page.evaluate(() => window.__del.useApp.getState().set({ explodeGroup: 'turbo', explode: 1 })));
await step('motor: detroit-dd15', () => page.evaluate(() => window.__del.useApp.getState().set({ engineId: 'detroit-dd15' })));
await step('motor: volvo-d13', () => page.evaluate(() => window.__del.useApp.getState().set({ engineId: 'volvo-d13' })));
await step('seleccionar pieza', () => page.evaluate(() => window.__del.useSelection.getState().select('turbo')));
await step('corte libre', () => page.evaluate(() => window.__del.useApp.getState().set({ cut: 'libre', cutOffset: 0.2 })));
await step('abrir comparador', () => page.evaluate(() => window.__del.useApp.getState().set({ showComparator: true })));
console.log('comparador listo:', await page.evaluate(() => !document.querySelector('.cmp-loading')));
await step('cerrar comparador', () => page.evaluate(() => window.__del.useApp.getState().set({ showComparator: false })));
await browser.close();
