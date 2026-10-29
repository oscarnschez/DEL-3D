// Medición de rendimiento en escenarios representativos (Playwright preinstalado).
// Cuenta draw calls y triángulos interceptando WebGL, y mide intervalos entre frames (rAF).
// Uso: node scripts/bench.mjs [url] [segundos-por-escenario] > resultado.json
// IMPORTANTE: en el contenedor de desarrollo sólo hay render por software (SwiftShader);
// los FPS absolutos no representan una GPU real, sólo sirven para comparar antes/después.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:4173/';
const secs = Number(process.argv[3] ?? 6);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 720) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() => {
  const w = window;
  w.__bench = { frames: [], calls: 0, tris: 0, callsPerFrame: [], trisPerFrame: [], heap: [] };
  const B = w.__bench;
  const count = (mode, n, inst = 1) => {
    B.calls++;
    // 4 = TRIANGLES
    if (mode === 4) B.tris += (n / 3) * inst;
  };
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const p = C.prototype;
    const de = p.drawElements;
    p.drawElements = function (m, n, t, o) {
      count(m, n);
      return de.call(this, m, n, t, o);
    };
    const da = p.drawArrays;
    p.drawArrays = function (m, f, n) {
      count(m, n);
      return da.call(this, m, f, n);
    };
    if (p.drawElementsInstanced) {
      const dei = p.drawElementsInstanced;
      p.drawElementsInstanced = function (m, n, t, o, i) {
        count(m, n, i);
        return dei.call(this, m, n, t, o, i);
      };
    }
    if (p.drawArraysInstanced) {
      const dai = p.drawArraysInstanced;
      p.drawArraysInstanced = function (m, f, n, i) {
        count(m, n, i);
        return dai.call(this, m, f, n, i);
      };
    }
  }
  let last = performance.now();
  const loop = (t) => {
    B.frames.push(t - last);
    B.callsPerFrame.push(B.calls);
    B.trisPerFrame.push(B.tris);
    B.calls = 0;
    B.tris = 0;
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

const t0 = Date.now();
await page.goto(url);
await page.waitForSelector('canvas');
// espera a que la escena esté lista (primer frame con draw calls)
await page.waitForFunction(() => window.__bench.callsPerFrame.some((c) => c > 20), null, { timeout: 120000 });
const loadMs = Date.now() - t0;
await page.waitForTimeout(4000);

const reset = () => page.evaluate(() => Object.assign(window.__bench, { frames: [], callsPerFrame: [], trisPerFrame: [] }));
const read = () =>
  page.evaluate(() => {
    const B = window.__bench;
    const f = B.frames.slice(2).sort((a, b) => a - b);
    const avg = f.reduce((s, x) => s + x, 0) / Math.max(1, f.length);
    const pct = (q) => f[Math.min(f.length - 1, Math.floor(f.length * q))] ?? 0;
    // los draw calls de un frame se registran en el callback rAF siguiente; se toma la mediana
    const med = (a) => {
      const s = a.filter((x) => x > 0).sort((x, y) => x - y);
      return s[Math.floor(s.length / 2)] ?? 0;
    };
    const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null;
    return {
      frames: f.length,
      fps: Math.round((1000 / avg) * 10) / 10,
      frameMsAvg: Math.round(avg),
      frameMsP95: Math.round(pct(0.95)),
      drawCalls: med(B.callsPerFrame),
      triangles: Math.round(med(B.trisPerFrame)),
      jsHeapMB: mem,
    };
  });
const click = (text) => page.locator('button', { hasText: text }).first().evaluate((b) => b.click());

const results = { url, secondsPerScenario: secs, viewport: page.viewportSize(), loadMs, renderer: 'SwiftShader (software)', scenarios: {} };
const measure = async (name, fn) => {
  if (fn) await fn();
  await page.waitForTimeout(2500);
  await reset();
  await page.waitForTimeout(secs * 1000);
  results.scenarios[name] = await read();
  console.error(name, JSON.stringify(results.scenarios[name]));
};

const scen = (process.env.SCEN ?? 'reposo,marcha,interior,combustion,lubricacion,rayosx,despiece,tecnico').split(',');
const steps = {
  reposo: null,
  marcha: () => click('ENCENDER'),
  interior: () => click('INTERIOR'),
  combustion: () => click('COMBUSTIÓN'),
  lubricacion: () => click('LUBRICACIÓN'),
  rayosx: () => click('RAYOS X'),
  despiece: () => click('DESPIECE'),
  tecnico: () => click('TÉCNICO'),
};
for (const s of scen) await measure(s, steps[s]);
results.errors = errors;
console.log(JSON.stringify(results, null, 2));
await browser.close();
