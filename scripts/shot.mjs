// Captura rápida de una vista con acciones previas (desarrollo). Requiere el servidor de desarrollo.
// Uso: node scripts/shot.mjs <salida.png> '<js a evaluar con __del>' [espera-ms] [url]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [out, js = '', wait = '6000', url = 'http://localhost:5173/?calidad=equilibrado'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 760) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`[${m.type()}] ${m.text()}`));
await page.goto(url);
await page.waitForFunction(() => window.__del && window.__del.cameraApi.controls, null, { timeout: 120000 });
await page.waitForTimeout(4000);
if (js) await page.evaluate(js);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, timeout: 120000 });
console.log('ok', out, JSON.stringify(await page.evaluate(() => window.__delPerf)));
for (const e of errors.slice(0, 15)) console.log(e);
await browser.close();
