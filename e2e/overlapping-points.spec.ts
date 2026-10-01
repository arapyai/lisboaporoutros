import { expect, test, type Page } from '@playwright/test';
import { mapStyle } from './routeFixture';

const type = { id: 'literary', slug: 'literary', name_pt: 'Ponto literário', icon_key: 'book-open', color: '#C45732', is_active: true };
function point(id: string, title: string, lng: number, count = 1) {
  return { id, title_pt: title, title, lat: 38.7223, lng, address: `Endereço ${id}`, texts_count: count, authors: [], point_type: type };
}
const points = [point('a', 'Local A', -9.1393, 2), point('b', 'Local B', -9.1393), point('near', 'Próximo mas separado', -9.138), point('far', 'Outro local', -9.13)];
function detail(p: typeof points[number], lang = 'pt') {
  return { ...p, texts: Array.from({ length: p.texts_count }, (_, i) => ({
    id: `${p.id}-${i}`, content_pt: `Texto ${p.id}-${i}`, content: `${lang.toUpperCase()} texto ${p.id}-${i}`,
    content_type: 'prose', author_id: i ? 'author-2' : 'author-1', author: { id: i ? 'author-2' : 'author-1', name: `Autor ${p.id}-${i}` },
    source_work: `Obra ${p.id}-${i}`, audio_files: [{ id: `audio-${p.id}-${i}-${lang}`, lang, public_url: `/audio/${p.id}-${i}-${lang}.mp3` }]
  })) };
}
async function prepare(page: Page) {
  await page.addInitScript(() => { localStorage.setItem('lisboa.onboarded', 'true'); localStorage.setItem('lisboa.language', 'pt'); });
  await page.route(/.*\/style\.json.*/, route => route.fulfill({ json: mapStyle }));
  await page.route('**/api/v1/point-types', route => route.fulfill({ json: { data: [type], meta: {} } }));
  await page.route('**/api/v1/authors**', route => route.fulfill({ json: { data: [], meta: {} } }));
  await page.route('**/api/v1/points**', route => {
    const url = new URL(route.request().url());
    const selected = points.find(p => url.pathname.endsWith('/' + p.id));
    return route.fulfill({ json: { data: selected ? detail(selected, url.searchParams.get('lang') ?? 'pt') : points, meta: {} } });
  });
  await page.goto('/#/map');
  await expect(page.locator('.point-row')).toHaveCount(points.length);
}
for (const width of [390, 1366]) test(`same-location excerpts use the sheet without neighbouring points at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET') writes.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  await prepare(page);
  await page.locator('.point-row').filter({ hasText: 'Local A' }).click();
  const sheet = page.locator('.point-sheet');
  await expect(sheet).toContainText('Trecho 1 de 2');
  await expect(sheet.locator('.byline')).toHaveText('Autor a-0');
  const oldAudio = await sheet.locator('audio').elementHandle();
  const next = sheet.getByRole('button', { name: 'Próximo trecho', exact: true });
  await next.focus();
  await next.press('Enter');
  await expect(sheet).toContainText('Trecho 2 de 2');
  await expect(sheet.locator('.byline')).toHaveText('Autor a-1');
  await expect(next).toBeFocused();
  await expect(next).toBeDisabled();
  expect(await oldAudio!.evaluate(el => el.isConnected)).toBe(false);
  await expect(sheet.locator('audio')).toHaveAttribute('src', /a-1-pt\.mp3$/);
  await sheet.locator('summary').click();
  await expect(sheet.locator('ol button')).toHaveCount(2);
  await expect(sheet).not.toContainText('Local B');
  await expect(sheet).not.toContainText('Próximo mas separado');
  await sheet.locator('ol button').first().click();
  await expect(sheet).toContainText('Trecho 1 de 2');
  const rects = await sheet.evaluate(el => [...el.querySelectorAll('.overlap-navigation nav button')].map(b => ({ width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })));
  expect(rects.every(r => r.width >= 44 && r.height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await sheet.locator('summary').click();
  await page.screenshot({ path: testInfo.outputPath('overlap-sheet.png') });
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(sheet).toContainText('Excerpt 1 of 2');
  await expect(sheet).toContainText('EN texto a-0');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.locator('.point-row').filter({ hasText: 'Próximo mas separado' }).click();
  await expect(sheet.getByRole('heading', { name: 'Próximo mas separado' })).toBeVisible();
  await expect(sheet.locator('.overlap-navigation')).toHaveCount(0);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
test('street collision opens only that group and excludes a nearby separable marker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  // Engines with no WebGL still exercise the actual sheet via the list above.
  test.skip(!await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2'))), 'WebGL unavailable in this engine');
  await page.getByRole('button', { name: '3 pontos próximos', exact: true }).click();
  const overlap = page.getByRole('button', { name: '3 conteúdos sobrepostos', exact: true });
  await expect(overlap).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ponto literário: Próximo mas separado', exact: true })).toBeVisible();
  await overlap.click();
  const sheet = page.locator('.point-sheet');
  await expect(sheet).toContainText('Trecho 1 de 3');
  await sheet.getByRole('button', { name: 'Próximo trecho', exact: true }).click();
  await sheet.getByRole('button', { name: 'Próximo trecho', exact: true }).click();
  await expect(sheet).toContainText('Trecho 3 de 3');
  await expect(sheet.getByRole('heading', { name: 'Local B' })).toBeVisible();
  await expect(sheet).toContainText('Endereço b');
  await expect(sheet.locator('.byline')).toHaveText('Autor b-0');
  await expect(sheet.locator('audio')).toHaveAttribute('src', /b-0-pt\.mp3$/);
  await expect(sheet).not.toContainText('Próximo mas separado');
  await expect(sheet.getByRole('button', { name: 'Próximo trecho', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(overlap).toBeVisible();
});
test('failed detail has retry and a late response cannot reopen a closed group', async ({ page }) => {
  await prepare(page);
  let fail = true;
  await page.route('**/api/v1/points/a?*', route => fail ? route.fulfill({ status: 503, json: { detail: 'Offline' } }) : route.fulfill({ json: { data: detail(points[0]), meta: {} } }));
  await page.locator('.point-row').filter({ hasText: 'Local A' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.point-sheet')).toContainText('Trecho 1 de 2');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/v1/points/a?*', async route => { await gate; await route.fulfill({ json: { data: detail(points[0]), meta: {} } }); });
  await page.locator('.point-row').filter({ hasText: 'Local A' }).click();
  await expect(page.locator('.point-sheet').getByRole('status')).toContainText('A carregar conteúdos');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  finish();
  await expect(page.locator('.point-sheet')).toHaveCount(0);
});

test('zooming apart a collision closes its navigation instead of retaining nearby points', async ({ page }) => {
  await prepare(page);
  test.skip(!await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2'))), 'WebGL unavailable in this engine');
  await page.route('**/api/v1/points?*', route => route.fulfill({ json: { data: points.map(p => p.id === 'b' ? { ...p, lng: -9.1392 } : p), meta: {} } }));
  await page.reload();
  await page.getByRole('button', { name: '3 pontos próximos', exact: true }).click();
  await page.getByRole('button', { name: '3 conteúdos sobrepostos', exact: true }).click();
  await expect(page.locator('.point-sheet')).toContainText('Trecho 1 de 3');
  // Let each map zoom animation complete rather than cancel it with the next click.
  for (let i = 0; i < 3; i++) {
    await page.locator('.maplibregl-canvas').press('+');
    await page.waitForTimeout(650);
  }
  await expect(page.locator('.point-sheet')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ponto literário: Local B', exact: true })).toBeVisible();
});
