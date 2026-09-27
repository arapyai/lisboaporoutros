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
