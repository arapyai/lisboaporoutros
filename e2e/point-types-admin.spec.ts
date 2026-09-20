import { expect, test } from '@playwright/test';

test('imports point catalog rows and starts a reviewable point translation batch', async ({ page }) => {
  let batchPayload: Record<string, unknown> | null = null;
  await page.addInitScript(() => localStorage.setItem('ecosdelisboa.admin.token', 'e2e-token'));
  await page.route('**/api/v1/admin/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const envelope = (data: unknown) => route.fulfill({ json: { data, meta: {} } });
    if (url.pathname.endsWith('/auth/me')) return envelope({ id: 'admin', email: 'admin@example.com', is_active: true });
    if (url.pathname.endsWith('/languages')) return envelope([
      { code: 'pt', locale: 'pt-PT', name: 'Português', is_active: true, is_source: true },
      { code: 'en', locale: 'en-US', name: 'Inglês', is_active: true, is_source: false }
    ]);
    if (url.pathname.endsWith('/catalog-import/preview')) return envelope([
      { row_number: 2, point_name: 'Sala de Leitura', point_type: 'reading', action: 'create', geocoded: false, lat: 38.71, lng: -9.14, errors: [] }
    ]);
    if (url.pathname.endsWith('/catalog-import/confirm')) return envelope({
      created: 1, updated: 0, errors: [], imported_point_ids: ['point-reading']
    });
    if (url.pathname.endsWith('/point-batches') && method === 'POST') {
      batchPayload = route.request().postDataJSON();
      return envelope({
        id: 'batch-point', status: 'running', current_stage: 'generating_translations',
        source: 'point-csv', voice_overrides: {}, auto_approve_translations: false,
        generate_translated_audio: false, created_at: new Date().toISOString(),
        progress: { total: 1, processed: 0, succeeded: 0, skipped: 0, failed: 0 },
        pending_reviews: [], errors: [], items: []
      });
    }
    if (url.pathname.endsWith('/automation/batches')) return envelope([]);
    return envelope([]);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'CSV' }).click();
  await page.getByRole('tab', { name: 'Cadastro de pontos' }).click();
  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'points.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('point_type,point_name,lat_override,lng_override\nreading,Sala de Leitura,38.71,-9.14\n')
  });
  await page.getByRole('button', { name: 'Gerar preview' }).click();
  await expect(page.getByRole('cell', { name: 'Sala de Leitura' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  await expect(page.getByText('Cadastro concluído: 1 criados e 0 atualizados.')).toBeVisible();
  await page.getByLabel('Inglês').check();
  await page.getByRole('button', { name: 'Gerar traduções' }).click();
  await expect.poll(() => batchPayload).toEqual({
    point_ids: ['point-reading'],
    target_languages: ['en'],
    policy: 'missing_only',
    source: 'point-csv'
  });
  await expect(page.getByRole('button', { name: 'Lote criado' })).toBeVisible();
});

test('creates and updates a point type from the controlled icon and color catalogs', async ({ page }) => {
  const pointTypes: Array<Record<string, unknown>> = [
    {
      id: 'type-literary', slug: 'literary', name_pt: 'Ponto literário', icon_key: 'book-open',
      color: '#C45732', sort_order: 10, is_active: true
    }
  ];
  let createdPayload: Record<string, unknown> | null = null;
  let updatedPayload: Record<string, unknown> | null = null;

  await page.addInitScript(() => localStorage.setItem('ecosdelisboa.admin.token', 'e2e-token'));
  await page.route('**/api/v1/admin/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const envelope = (data: unknown) => route.fulfill({ json: { data, meta: {} } });
    if (url.pathname.endsWith('/auth/me')) return envelope({ id: 'admin', email: 'admin@example.com', is_active: true });
    if (url.pathname.endsWith('/point-types') && method === 'GET') return envelope(pointTypes);
    if (url.pathname.endsWith('/point-types') && method === 'POST') {
      createdPayload = route.request().postDataJSON();
      const created = { id: 'type-mobile', slug: 'biblioteca-movel', ...createdPayload };
      pointTypes.unshift(created);
      return envelope(created);
    }
    if (url.pathname.endsWith('/point-types/type-mobile') && method === 'PUT') {
      updatedPayload = route.request().postDataJSON();
      Object.assign(pointTypes[0], updatedPayload);
      return envelope(pointTypes[0]);
    }
    if (url.pathname.endsWith('/automation/batches')) return envelope([]);
    return envelope([]);
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Tipos de ponto' }).click();
  await expect(page.getByRole('cell', { name: 'Ponto literário' })).toBeVisible();

  await page.getByLabel('Nome em português').fill('Biblioteca móvel');
  await page.getByLabel('Ícone').selectOption('library');
  await page.getByLabel('Cor').selectOption('#2F6F68');
  await page.getByLabel('Ordem').fill('30');
  await expect(page.locator('.point-type-preview')).toContainText('Biblioteca móvel');
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect.poll(() => createdPayload).toEqual({
    name_pt: 'Biblioteca móvel', icon_key: 'library', color: '#2F6F68', sort_order: 30,
    is_active: true
  });

  const row = page.getByRole('row').filter({ hasText: 'Biblioteca móvel' });
  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByLabel('Nome em português')).toHaveValue('Biblioteca móvel');
  await expect(page.getByLabel('Slug')).toHaveCount(0);
  await page.getByLabel('Ordem').fill('40');
  await page.getByLabel('Ativo').uncheck();
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect.poll(() => updatedPayload).toEqual({
    name_pt: 'Biblioteca móvel', icon_key: 'library', color: '#2F6F68', sort_order: 40,
    is_active: false
  });
});
