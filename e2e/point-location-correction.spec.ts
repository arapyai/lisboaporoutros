import { expect, test, type Page } from '@playwright/test';
import { mapStyle } from './routeFixture';

const point = { id: 'chiado', title_pt: 'Chiado', title: 'Chiado', lat: 38.71, lng: -9.14,
  texts: [], authors: [], texts_count: 0, point_type: { id: 'literary', slug: 'literary',
    name_pt: 'Ponto literário', icon_key: 'book-open', color: '#C45732', sort_order: 10, is_active: true } };
const user = { id: 'editor', email: 'editor@example.com', is_active: true };

async function prepare(page: Page, authenticated = true, saveStatus = 200) {
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript(({ authenticated }) => {
    localStorage.setItem('lisboa.onboarded', 'true'); localStorage.setItem('lisboa.language', 'pt');
    if (authenticated) sessionStorage.setItem('lisboa.public-admin-session.v1', 'test-token');
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition() { return 1; }, clearWatch() {},
      getCurrentPosition(success: PositionCallback, failure: PositionErrorCallback) {
        const mode = document.documentElement.dataset.gpsMode;
        queueMicrotask(() => {
          if (mode === 'denied' || mode === 'timeout') {
            failure({ code: mode === 'denied' ? 1 : 3 } as GeolocationPositionError); return;
          }
          success({ coords: { latitude: mode === 'far' ? 38.715 : 38.7101, longitude: -9.1401,
            accuracy: mode === 'low' ? 100 : 12 }, timestamp: Date.now() } as GeolocationPosition);
        });
      }
    } });
  }, { authenticated });
  await page.route(/.*\/style\.json.*/, route => route.fulfill({ json: mapStyle }));
  await page.route('**/api/v1/authors**', route => route.fulfill({ json: { data: [], meta: { total: 0 } } }));
  await page.route('**/api/v1/point-types', route => route.fulfill({ json: { data: [point.point_type], meta: {} } }));
  await page.route('**/api/v1/admin/auth/me', route => route.fulfill({ json: { data: user, meta: {} } }));
  await page.route('**/api/v1/admin/auth/login', route => route.fulfill({ json: { data: { access_token: 'test-token' }, meta: {} } }));
  await page.route('**/api/v1/admin/points/chiado/location-history', route => route.fulfill({ json: { data: [
    { id: 'log', updated_at: new Date().toISOString(), admin_email: user.email, source: 'admin_gps_pwa',
      previous_lat: 38.71, previous_lng: -9.14, lat: 38.7101, lng: -9.1401, accuracy_m: 12 }
  ], meta: {} } }));
  await page.route('**/api/v1/admin/points/chiado/location', route => {
    const body = route.request().postDataJSON(); writes.push(body);
    expect(route.request().headers().authorization).toBe('Bearer test-token');
    return route.fulfill({ status: saveStatus, json: saveStatus === 200 ? { data: { ...point, lat: body.lat,
      lng: body.lng, location_updated_at: new Date().toISOString(), location_update_source: 'admin_gps_pwa' }, meta: {} }
      : { detail: 'test error' } });
  });
  await page.route('**/api/v1/points**', route => {
    const detail = new URL(route.request().url()).pathname.endsWith('/chiado');
    return route.fulfill({ json: { data: detail ? point : [point], meta: { total: 1 } } });
  });
  await page.goto('/#/map');
  await page.locator('.point-row').filter({ hasText: 'Chiado' }).click();
  return writes;
}

test('anonymous user must sign in; cancel never writes and confirmation records the correction', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const writes = await prepare(page, false);
  await expect(page.getByRole('button', { name: 'Corrigir localização pelo GPS' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acesso administrativo', exact: true }).click();
  await page.getByLabel('E-mail administrativo').fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('not-a-real-password');
  await page.getByRole('button', { name: 'Entrar como administrador', exact: true }).click();
  await page.getByRole('button', { name: 'Corrigir localização pelo GPS' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Confirmar atualização' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Obter posição atual' }).click();
  await expect(dialog).toContainText('Precisão: ±12 m');
  expect(writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Corrigir localização pelo GPS' }).click();
  await dialog.getByRole('button', { name: 'Obter posição atual' }).click();
  await dialog.getByRole('button', { name: 'Confirmar atualização' }).click();
  await expect(page.getByText('Localização atualizada e registrada no histórico.')).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ lat: 38.7101, lng: -9.1401, accuracy_m: 12, expected_lat: 38.71, expected_lng: -9.14 });
  await expect(page.getByText(/Última correção:/)).toContainText('GPS no site');
  await page.getByRole('button', { name: 'Histórico da localização' }).click();
  await expect(page.locator('.gps-history')).toContainText('editor@example.com');
  await expect(page.locator('.gps-history')).toContainText('38.710000');
});

test('denied, timeout and imprecise GPS keep confirmation disabled', async ({ page }) => {
  const writes = await prepare(page);
  await page.getByRole('button', { name: 'Corrigir localização pelo GPS' }).click();
  const dialog = page.getByRole('dialog');
  for (const [mode, message] of [['denied', 'Localização não autorizada'], ['timeout', 'GPS demorou'], ['low', 'Precisão insuficiente']]) {
    await page.evaluate(mode => { document.documentElement.dataset.gpsMode = mode; }, mode);
    await dialog.getByRole('button', { name: 'Obter posição atual' }).click();
    await expect(dialog.getByRole('alert')).toContainText(message);
    await expect(dialog.getByRole('button', { name: 'Confirmar atualização' })).toBeDisabled();
  }
  expect(writes).toHaveLength(0);
});

test('large displacement requires extra confirmation; dialog fits mobile and desktop', async ({ page }) => {
  const writes = await prepare(page);
  await page.evaluate(() => { document.documentElement.dataset.gpsMode = 'far'; });
  await page.getByRole('button', { name: 'Corrigir localização pelo GPS' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Obter posição atual' }).click();
  await expect(dialog.getByRole('button', { name: 'Confirmar atualização' })).toBeDisabled();
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
  await dialog.getByRole('checkbox').check();
  await expect(dialog.getByRole('button', { name: 'Confirmar atualização' })).toBeEnabled();
  expect(writes).toHaveLength(0);
});

for (const status of [401, 409, 500]) {
  test(`save failure ${status} never announces success`, async ({ page }) => {
    await prepare(page, true, status);
    await page.getByRole('button', { name: 'Corrigir localização pelo GPS' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Obter posição atual' }).click();
    await dialog.getByRole('button', { name: 'Confirmar atualização' }).click();
    const expected = status === 401 ? 'Sessão expirada' : status === 409 ? 'Outro administrador' : 'Não foi possível';
    await expect(page.getByRole('alert').filter({ hasText: expected })).toBeVisible();
    await expect(page.getByText('Localização atualizada e registrada no histórico.')).toHaveCount(0);
  });
}
