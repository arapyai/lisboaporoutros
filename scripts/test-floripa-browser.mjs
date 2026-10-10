// Run against the actual seeded Floripa API/PWA; no route mocks or paid providers.
import assert from 'node:assert/strict';

const { chromium, firefox, webkit } = await import(process.env.PLAYWRIGHT_LIBRARY_URL || '@playwright/test');

const baseURL = process.env.FLORIPA_QA_URL || 'http://localhost:5173';
const results = [];
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.FLORIPA_QA_ENGINE && process.env.FLORIPA_QA_ENGINE !== name) continue;
  let browser;
  let activePage;
  try {
    const executablePath = process.env[`PLAYWRIGHT_${name.toUpperCase()}_EXECUTABLE_PATH`];
    browser = await engine.launch({ headless: true, timeout: 15000,
      ...(executablePath ? { executablePath } : {}),
      ...(name === 'firefox' && process.env.FIREFOX_SOFTWARE_WEBGL === '1'
        ? { firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.enable-webgl2': true, 'webgl.allow-software': true } }
        : {})
    });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      activePage = page;
      page.on('pageerror', error => console.log(`${name} page error: ${error.message}`));
      page.setDefaultTimeout(10000);
      await page.goto(baseURL);
      assert.equal(await page.title(), 'Floripa Literary Map');
      const [pointsResponse] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/v1/points?') && response.status() === 200),
        page.getByRole('button', { name: 'Entrar', exact: true }).click()
      ]);
      assert.equal((await pointsResponse.json()).data.length, 24);
      await page.getByRole('button', { name: 'Percursos', exact: true }).click();
      await page.getByRole('heading', { name: 'Escolha uma história por Florianópolis' }).waitFor();
      await page.getByRole('button', { name: 'Começar percurso', exact: true }).click();
      await page.getByRole('button', { name: 'Cheguei', exact: true }).click();
      await page.getByText('Áudio indisponível; você pode ler e continuar.').waitFor();
      await page.getByText(/Antonieta de Barros estudou e lecionou/).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Áudio automático' }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.getByRole('button', { name: 'Continuar percurso', exact: true }).click();
      await page.getByRole('button', { name: 'Cheguei', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Fechar percurso', exact: true }).click();
      await page.screenshot({ path: `/tmp/floripa-${name}-${viewport.width}.png` });
      results.push({ engine: name, viewport, passed: true });
      console.log(`${name} ${viewport.width}: passed`);
      await context.close();
    }
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      console.log((await activePage.locator('body').innerText()).slice(0, 1500));
      await activePage.screenshot({ path: `/tmp/floripa-${name}-failure.png`, timeout: 5000 }).catch(() => {});
    }
    results.push({ engine: name, passed: false, error: String(error).slice(0, 1200) });
    console.log(`${name}: ${String(error).slice(0, 1200)}`);
  } finally {
    if (browser) await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
}
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.some(result => !result.passed) ? 1 : 0;
