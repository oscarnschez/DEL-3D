// Serie de capturas en una sola sesión de navegador (verificación visual con render por software).
// Uso: node scripts/shots.mjs <plan.json> [url]
// plan.json: [{ "out": "a.png", "js": "...", "wait": 8000 }, ...]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [planFile, url = 'http://localhost:5173/?calidad=baja'] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 860) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(`[error] ${m.text()}`));
await page.goto(url);
await page.waitForFunction(() => window.__del && window.__del.cameraApi.controls, null, { timeout: 180000 });
await page.waitForTimeout(5000);
for (const step of plan) {
  if (step.js) await page.evaluate(step.js);
  await page.waitForTimeout(step.wait ?? 6000);
  await page.screenshot({ path: step.out, timeout: 180000 });
  console.log('ok', step.out, JSON.stringify(await page.evaluate(() => ({ fps: window.__delPerf.fps.toFixed(2), calls: window.__delPerf.calls, programs: window.__delPerf.programs }))));
}
for (const e of errors.slice(0, 20)) console.log(e);
await browser.close();
