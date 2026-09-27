import { expect, test, type Page, type Route } from '@playwright/test';
import { mapStyle } from './routeFixture';

const pointTypes = [
  { id: '11111111-1111-4111-8111-111111111111', slug: 'literary', name_pt: 'Ponto literário', icon_key: 'book-open', color: '#C45732', sort_order: 10, is_active: true },
  { id: '22222222-2222-4222-8222-222222222222', slug: 'reading', name_pt: 'Ponto de leitura', icon_key: 'library', color: '#2F6F68', sort_order: 20, is_active: true }
];

const authors = Array.from({ length: 24 }, (_, index) => ({
  id: `author-${index + 1}`,
  name: `Autor ${String(index + 1).padStart(2, '0')}`,
  bio_pt: `Biografia ${index + 1}`,
  birth_year: 1900 + index,
  death_year: null,
  photo_url: null,
  elevenlabs_voice_id: null
}));

const points = Array.from({ length: 24 }, (_, index) => ({
  id: `point-${index + 1}`,
  point_type_id: pointTypes[index % 2].id,
  point_type: pointTypes[index % 2],
  title_pt: `Ponto ${String(index + 1).padStart(2, '0')}`,
  description_pt: '',
  address: `Rua ${index + 1}`,
  neighborhood: 'Lisboa',
  lat: 38.71 + index / 10_000,
  lng: -9.14 - index / 10_000,
  translations: []
}));

async function prepareAdmin(page: Page, onPut: (path: string, payload: Record<string, unknown>) => void = () => {}) {
  await page.addInitScript(() => {
    localStorage.setItem('ecosdelisboa.admin.token', 'e2e-token');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({ coords: { latitude: 38.713812, longitude: -9.139125, accuracy: 14 } } as GeolocationPosition);
        }
      }
    });
  });
  await page.route(/.*\/style\.json.*/, (route) => route.fulfill({ json: mapStyle }));
  await page.route('**/api/v1/admin/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const envelope = (data: unknown) => route.fulfill({ json: { data, meta: {} } });
    if (url.pathname.endsWith('/auth/me')) return envelope({ id: 'admin', email: 'admin@example.com', is_active: true });
    if (url.pathname.endsWith('/authors') && method === 'GET') return envelope(authors);
    if (url.pathname.endsWith('/points') && method === 'GET') return envelope(points);
    if (url.pathname.endsWith('/point-types') && method === 'GET') return envelope(pointTypes);
    if (url.pathname.endsWith('/languages')) return envelope([
      { code: 'pt', locale: 'pt-PT', name: 'Português', is_active: true, is_source: true },
      { code: 'en', locale: 'en-US', name: 'Inglês', is_active: true, is_source: false }
    ]);
    if (url.pathname.endsWith('/texts') && method === 'GET') return envelope([{
      id: 'text-1', point_id: points[0].id, author_id: authors[0].id,
      content_pt: 'Trecho editorial', source_work: 'Obra', source_year: 2026,
      content_type: 'prose', origin: 'manual', author: authors[0], point: points[0],
      translations: [], audio_files: []
    }]);
    if (url.pathname.endsWith('/translations') || url.pathname.endsWith('/audio') || url.pathname.endsWith('/voices') || url.pathname.endsWith('/automation/batches')) return envelope([]);
    if (url.pathname.endsWith('/editorial-export') && method === 'POST') {
      return route.fulfill({
        body: 'xlsx-test',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="lisboa-pacote-editorial.xlsx"' }
      });
    }
    if (method === 'PUT') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      onPut(url.pathname, payload);
      const current = url.pathname.includes('/authors/')
        ? authors.find((item) => url.pathname.endsWith(item.id))
        : points.find((item) => url.pathname.endsWith(item.id));
      return envelope({ ...current, ...payload });
    }
    return envelope([]);
  });
  await page.goto('/');
}

test('edits a long-list author with visible focus and save feedback on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let update: { path: string; payload: Record<string, unknown> } | null = null;
  await prepareAdmin(page, (path, payload) => { update = { path, payload }; });
  await page.getByRole('button', { name: 'Autores' }).click();
  const lastRow = page.getByRole('row').filter({ hasText: 'Autor 24' });
  await lastRow.getByRole('button', { name: 'Editar' }).click();
  const heading = page.getByRole('heading', { name: 'Editar autores' });
  await expect(heading).toBeInViewport();
  await expect(heading).toBeFocused();
  await page.getByLabel('Nome').fill('Autor 24 revisto');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => update).toMatchObject({ path: '/api/v1/admin/authors/author-24' });
  await expect(page.getByRole('status')).toContainText('Alterações guardadas');
});

test('shows readable point types and applies the current high-accuracy location', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let update: { path: string; payload: Record<string, unknown> } | null = null;
  await prepareAdmin(page, (path, payload) => { update = { path, payload }; });
  await page.getByRole('button', { name: 'Pontos' }).click();
  const lastRow = page.getByRole('row').filter({ hasText: 'Ponto 24' });
  await lastRow.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByRole('heading', { name: 'Editar pontos' })).toBeInViewport();
  await expect(page.getByLabel('Tipo de ponto').locator('option')).toHaveText([
    'Selecione um tipo', 'Ponto literário', 'Ponto de leitura'
  ]);
  await expect(page.getByLabel('Tipo de ponto')).not.toContainText('11111111');
  await page.getByRole('button', { name: 'Usar minha localização atual' }).click();
  await expect(page.getByText('Precisão estimada: 14 m')).toBeVisible();
  await expect(page.getByLabel('Latitude')).toHaveValue('38.713812');
  await expect(page.getByLabel('Longitude')).toHaveValue('-9.139125');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => update).toMatchObject({
    path: '/api/v1/admin/points/point-24',
    payload: { lat: 38.713812, lng: -9.139125 }
  });
});

test('exports the currently filtered editorial texts as a workbook', async ({ page }) => {
  await prepareAdmin(page);
  await page.getByRole('button', { name: 'Textos' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar planilha (1)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/lisboa-pacote-editorial-\d{4}-\d{2}-\d{2}\.xlsx/);
});
