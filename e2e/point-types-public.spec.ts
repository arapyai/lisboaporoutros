import { expect, test, type Page } from '@playwright/test';
import { mapStyle } from './routeFixture';

const pointTypes = [
  { id: 'literary', slug: 'literary', name_pt: 'Ponto literário', icon_key: 'book-open', color: '#C45732', sort_order: 10, is_active: true },
  { id: 'reading', slug: 'reading', name_pt: 'Ponto de leitura', icon_key: 'library', color: '#2F6F68', sort_order: 20, is_active: true },
  { id: 'landmark', slug: 'landmark', name_pt: 'Marco histórico', icon_key: 'landmark', color: '#76507A', sort_order: 30, is_active: true },
  { id: 'coffee', slug: 'coffee', name_pt: 'Café', icon_key: 'coffee', color: '#6F5147', sort_order: 40, is_active: true }
];

const literary = {
  id: 'literary-point', title_pt: 'Chiado', title: 'Chiado', description_pt: null, description: null,
  address: 'Largo do Chiado', neighborhood: 'Chiado', lat: 38.7107, lng: -9.1421,
  texts_count: 1, authors: [{ id: 'pessoa', name: 'Fernando Pessoa' }], point_type: pointTypes[0]
};
const reading = {
  id: 'reading-point', title_pt: 'Cantinho de Leitura', title: 'Reading Corner',
  description_pt: 'Livros disponíveis para consulta, com uma descrição extensa para validar a leitura confortável em telas pequenas.',
  description: 'Books available to read, with a deliberately long description that validates wrapping and comfortable reading on small screens without hiding the selected place.',
  address: 'Jardim da Estrela', neighborhood: 'Estrela', lat: 38.7149, lng: -9.1602,
  texts_count: 0, authors: [], point_type: pointTypes[1]
};

async function preparePointMap(page: Page) {
  page.on('pageerror', (error) => console.error(`browser page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`browser console error: ${message.text()}`);
  });
  await page.addInitScript(() => {
    localStorage.setItem('lisboa.onboarded', 'true');
    localStorage.setItem('lisboa.language', 'en');
  });
  await page.route(/.*\/style\.json.*/, (route) => route.fulfill({ json: mapStyle }));
  await page.route('**/api/v1/point-types', (route) => route.fulfill({ json: { data: pointTypes, meta: { total: pointTypes.length } } }));
  await page.route('**/api/v1/authors**', (route) => route.fulfill({ json: { data: [], meta: { total: 0 } } }));
  await page.route('**/api/v1/points**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/reading-point')) {
      return route.fulfill({ json: { data: { ...reading, texts: [] }, meta: {} } });
    }
    const points = url.searchParams.get('type') === 'reading' ? [reading] : [literary, reading];
    return route.fulfill({ json: { data: points, meta: { total: points.length, lang: 'en' } } });
  });
  await page.goto('/#/map');
}

test('filters point types and opens an informational reading point without literary controls', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePointMap(page);
  await expect(page.getByRole('button', { name: 'Ponto de leitura', exact: true })).toBeVisible();
  await expect(page.getByText('Reading Corner')).toBeVisible();
  await page.getByRole('button', { name: 'Ponto de leitura', exact: true }).click();
  await expect(page.getByText('Chiado', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Reading Corner/ }).last().click();
  await expect(page.locator('.point-sheet')).toContainText('Ponto de leitura');
  await expect(page.locator('.point-sheet')).toContainText('Books available to read');
  await expect(page.locator('.point-sheet')).not.toContainText('Áudio indisponível');
  await expect(page.locator('.point-sheet').getByText('RSS')).toHaveCount(0);
  await expect(page.locator('.point-sheet').getByText('Transcript')).toHaveCount(0);
  if (browserName === 'chromium') {
    await expect(page.locator('.map-marker[aria-label="Ponto de leitura: Reading Corner"]')).toBeVisible();
  }

  const layout = await page.evaluate(() => {
    const chips = document.querySelector<HTMLElement>('.point-type-filters');
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflowX: chips ? getComputedStyle(chips).overflowX : ''
    };
  });
  expect(layout.documentWidth).toBe(layout.viewportWidth);
  expect(layout.overflowX).toBe('auto');
});

test('map filters, list and sheet avoid viewport clipping', async ({ page, browserName }) => {
  const viewports = browserName === 'chromium'
    ? [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }]
    : [{ width: 390, height: 844 }, { width: 1440, height: 900 }];
  await preparePointMap(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.getByText('Reading Corner').first().click();
    await expect(page.locator('.point-sheet')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      sheet: document.querySelector<HTMLElement>('.point-sheet')?.getBoundingClientRect().toJSON(),
      marker: document.querySelector<HTMLElement>('.map-marker.selected')?.getBoundingClientRect().toJSON()
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.sheet?.left).toBeGreaterThanOrEqual(0);
    expect(dimensions.sheet?.right).toBeLessThanOrEqual(dimensions.viewport);
    if (browserName === 'chromium' && viewport.width <= 620 && dimensions.marker) {
      expect(dimensions.marker.bottom).toBeLessThanOrEqual(dimensions.sheet?.top ?? 0);
    }
  }
});
