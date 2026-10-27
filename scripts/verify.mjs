// Verificación en navegador (Playwright preinstalado): carga la app, ejercita controles y guarda capturas.
// Uso: node scripts/verify.mjs [url] [carpeta-salida]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'verify-out';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 860) }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const shot = async (name, wait = 1200) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 90000 });
  console.log('captura', name);
};
const click = (text) => page.getByRole('button', { name: text, exact: false }).first().click();

await page.goto(url);
await page.waitForSelector('canvas');
await shot('01-exterior', 4000);
await click('ENCENDER MOTOR');
await shot('02-encendido', 2500);
const steps = (process.env.STEPS ?? 'all').split(',');
const want = (s) => steps.includes('all') || steps.includes(s);
if (want('modes')) {
  for (const [label, name] of [
    ['INTERIOR', '03-interior'],
    ['COMBUSTIÓN', '04-combustion'],
    ['LUBRICACIÓN', '05-lubricacion'],
    ['COMBUSTIBLE', '06-combustible'],
    ['REFRIGERACIÓN', '07-refrigeracion'],
    ['ADMISIÓN Y ESCAPE', '08-aire'],
    ['DESPIECE', '09-despiece'],
    ['RAYOS X', '10-rayosx'],
    ['TÉCNICO', '11-tecnico'],
  ]) {
    await click(label);
    await shot(name, 2200);
  }
}
const info = await page.evaluate(() => ({ title: document.title }));
console.log(JSON.stringify(info));
console.log('ERRORES/AVISOS:', errors.length);
for (const e of errors.slice(0, 30)) console.log(e);
await browser.close();
