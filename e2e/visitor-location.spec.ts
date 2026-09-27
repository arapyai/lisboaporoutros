import { expect, test, type Page } from '@playwright/test';
import { mapStyle } from './routeFixture';

const pointType = { id: 'literary', slug: 'literary', name_pt: 'Ponto literário', icon_key: 'book-open', color: '#C45732', sort_order: 10, is_active: true };
const point = {
  id: 'nearby-point', title_pt: 'Ponto próximo', title: 'Ponto próximo', description_pt: null,
  description: null, address: 'Lisboa', neighborhood: 'Lisboa', lat: 38.714, lng: -9.139,
  texts_count: 0, authors: [], point_type: pointType
};

async function preparePublic(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('lisboa.onboarded', 'true');
    localStorage.setItem('lisboa.language', 'pt');
  });
  await page.route(/.*\/style\.json.*/, (route) => route.fulfill({ json: mapStyle }));
  await page.route('**/api/v1/authors**', (route) => route.fulfill({ json: { data: [], meta: {} } }));
  await page.route('**/api/v1/point-types', (route) => route.fulfill({ json: { data: [pointType], meta: {} } }));
  await page.route('**/api/v1/points**', (route) => route.fulfill({ json: { data: [point], meta: {} } }));
}

test('queries nearby points with the visitor location and shows distance', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(success: PositionCallback) {
          queueMicrotask(() => success({ coords: { latitude: 38.7138, longitude: -9.1391, accuracy: 12 } } as GeolocationPosition));
          return 7;
        },
        clearWatch() {}
      }
    });
  });
  await preparePublic(page);
  const requestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname.endsWith('/api/v1/points') && url.searchParams.get('lat') === '38.7138';
  });
  await page.goto('/#/map');
  const request = await requestPromise;
  const url = new URL(request.url());
  expect(url.searchParams.get('lng')).toBe('-9.1391');
  await expect(page.getByText('A usar sua localização.')).toBeVisible();
  await expect(page.getByText(/Ponto próximo/).first()).toBeVisible();
  await expect(page.locator('.point-row').first()).toContainText(/m/);
});

test('falls back to Lisbon when location permission is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(_success: PositionCallback, error: PositionErrorCallback) {
          queueMicrotask(() => error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: 'denied' } as GeolocationPositionError));
          return 8;
        },
        clearWatch() {}
      }
    });
  });
  await preparePublic(page);
  await page.goto('/#/map');
  await expect(page.getByText('Localização não autorizada; a mostrar Lisboa.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tentar localização novamente' })).toBeVisible();
});

test('falls back to Lisbon when the visitor is outside Portugal', async ({ page }) => {
  const pointRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/v1/points')) {
      pointRequests.push(`${url.searchParams.get('lat')},${url.searchParams.get('lng')}`);
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(success: PositionCallback) {
          queueMicrotask(() => success({ coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 12 } } as GeolocationPosition));
          return 9;
        },
        clearWatch() {}
      }
    });
  });
  await preparePublic(page);
  await page.goto('/#/map');
  await expect(page.getByText('Você está fora de Portugal; a mostrar Lisboa.')).toBeVisible();
  await expect.poll(() => pointRequests.at(-1)).toBe('38.7223,-9.1393');
  expect(pointRequests).not.toContain('-23.5505,-46.6333');
  await expect(page.locator('.user-location-marker')).toHaveCount(0);
});

test('keeps both zoom controls inside narrow mobile viewports', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'MapLibre controls are not created by headless Firefox without WebGL in CI.');
  await preparePublic(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#/map');

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const zoomIn = page.getByRole('button', { name: 'Zoom in' });
    const zoomOut = page.getByRole('button', { name: 'Zoom out' });
    await expect(zoomIn).toBeVisible();
    await expect(zoomOut).toBeVisible();

    for (const control of [zoomIn, zoomOut]) {
      const bounds = await control.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    }
  }
});
