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
const click = (text) => page.locator('button', { hasText: text }).first().click();
const js = (code) => page.evaluate(code);

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
    ['VISTA TÉRMICA', '12-termica'],
  ]) {
    await click(label);
    await shot(name, 2200);
  }
  await click('EXTERIOR');
}
// Etapa 4: escenarios de iluminación, configuración, idioma, etiquetas, selección, corte libre, recorrido y comparador
if (want('stage4')) {
  for (const l of ['laboratorio', 'cine', 'estudio']) {
    await js(`window.__del.useSettings.getState().set({ lighting: '${l}' })`);
    await shot(`20-iluminacion-${l}`, 3000);
  }
  await page.getByRole('button', { name: 'Configuración' }).click();
  await shot('21-configuracion', 1500);
  await page.keyboard.press('Escape');
  await js(`window.__del.useSettings.getState().set({ lang: 'en' })`);
  await shot('22-ingles', 1500);
  await js(`window.__del.useSettings.getState().set({ lang: 'es' })`);
  await js(`window.__del.useApp.getState().set({ labels: true })`);
  await shot('23-etiquetas', 3000);
  await js(`window.__del.useSelection.getState().select('turbo')`);
  await shot('24-seleccion', 4000);
  await js(`window.__del.useSelection.getState().select(null); window.__del.useApp.getState().set({ labels: false, cut: 'libre', cutYaw: 60, cutPitch: 20 })`);
  await shot('25-corte-libre', 3000);
  await js(`window.__del.useApp.getState().set({ cut: 'none', tour: 'despiece' })`);
  await shot('26-recorrido', 9000);
  await js(`window.__del.useApp.getState().set({ tour: null, showComparator: true })`);
  await shot('27-comparador', 20000);
  await js(`window.__del.useApp.getState().set({ showComparator: false })`);
}
const info = await page.evaluate(() => ({ title: document.title }));
console.log(JSON.stringify(info));
console.log('ERRORES/AVISOS:', errors.length);
for (const e of errors.slice(0, 30)) console.log(e);
await browser.close();
