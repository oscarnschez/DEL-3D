// Sonda de recursos y de DOM: recursos de GPU tras varios cambios de motor (fugas) y mutaciones
// del DOM por segundo con el motor en marcha y en pausa (la UI de alta frecuencia debe ser barata).
// Uso: node scripts/probe.mjs [url]   (servidor de desarrollo o preview)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:5173/?calidad=baja';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__del && window.__delPerf && window.__delPerf.geometries > 0, null, { timeout: 120000 });
await page.waitForTimeout(8000);
const res = () => page.evaluate(() => ({ geometries: window.__delPerf.geometries, textures: window.__delPerf.textures, programs: window.__delPerf.programs }));
const set = (o) => page.evaluate((x) => window.__del.useApp.getState().set(x), o);

const out = { inicial: await res(), ciclos: [] };
const engines = ['detroit-dd15', 'volvo-d13', 'mack-mp8', 'cat-c15', 'paccar-mx13', 'cummins-x15'];
for (let round = 0; round < 2; round++) {
  for (const e of engines) {
    await set({ engineId: e });
    await page.waitForTimeout(5000);
  }
  out.ciclos.push(await res());
}

const mutations = async (label) => {
  const n = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const mo = new MutationObserver((l) => (n += l.length));
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        setTimeout(() => {
          mo.disconnect();
          resolve(n);
        }, 3000);
      }),
  );
  out[label] = { mutacionesEn3s: n };
};
await set({ running: false, paused: false });
await page.waitForTimeout(2000);
await mutations('reposo');
await set({ running: true, targetRpm: 1400 });
await page.waitForTimeout(4000);
await mutations('enMarcha');
await set({ paused: true });
await page.waitForTimeout(2000);
await mutations('pausa');
console.log(JSON.stringify(out, null, 2));
await browser.close();
