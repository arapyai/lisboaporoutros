import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 360, height: 800 }, { width: 1440, height: 900 }]) {
  test(`project credits and language navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // This static page and its navigation must remain usable when the API is unavailable.
    await page.route('**/api/v1/**', route => route.abort());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/#/about');
    await expect(page.getByRole('heading', { name: 'Há muitas Lisboas à sua espera.' })).toBeVisible();
    const program = page.getByRole('img', { name: 'Lisboa Cultura e Media', exact: true });
    const foundation = page.getByRole('img', { name: 'Fundação José Saramago', exact: true });
    await expect(program).toBeVisible();
    await expect(foundation).toBeVisible();
    await expect.poll(() => page.locator('footer img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const textBox = await page.locator('.about-recognition div').boundingBox();
    const programBox = await program.boundingBox();
    const supportBox = await page.locator('.about-support span').boundingBox();
    const foundationBox = await foundation.boundingBox();
    expect(textBox!.y + textBox!.height).toBeLessThanOrEqual(programBox!.y);
    expect(programBox!.y + programBox!.height).toBeLessThanOrEqual(supportBox!.y);
    expect(supportBox!.y + supportBox!.height).toBeLessThanOrEqual(foundationBox!.y);
    expect(foundationBox!.width).toBeLessThan(programBox!.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (viewport.width < 900) {
      await page.getByRole('combobox', { name: 'Escolha o idioma' }).selectOption('en');
    } else {
      await page.getByRole('button', { name: 'EN', exact: true }).click();
    }
    await expect(page.getByRole('heading', { name: 'Many Lisbons are waiting for you.' })).toBeVisible();
    await expect(page.locator('.about-support')).toContainText('SUPPORTED BY');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Many Lisbons are waiting for you.' })).toBeVisible();
    await page.getByRole('button', { name: 'Explore the map' }).click();
    await expect(page).toHaveURL(/#\/map$/);
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Many Lisbons are waiting for you.' })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/#\/map$/);
    expect(errors).toEqual([]);
  });
}
