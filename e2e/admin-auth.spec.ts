import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`password recovery and validation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let resetPayload: Record<string, string> | undefined;
    let failed = false;
    await page.route('**/api/v1/admin/auth/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/forgot-password')) {
        if (failed) return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
        return route.fulfill({ status: 202, json: { data: { message: 'Se o e-mail estiver cadastrado, receberá um link para redefinir a senha.' }, meta: {} } });
      }
      if (path.endsWith('/reset-password')) {
        resetPayload = route.request().postDataJSON();
        return route.fulfill({ json: { data: { message: 'Senha redefinida. Entre com a nova senha.' }, meta: {} } });
      }
      return route.fulfill({ status: 401, json: { detail: 'Invalid credentials' } });
    });
    await page.goto('/');
    await page.getByLabel('Email', { exact: true }).fill('owner@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
    await page.getByRole('button', { name: 'Esqueci a senha' }).click();
    await page.getByLabel('E-mail', { exact: true }).fill('owner@example.com');
    failed = true;
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByRole('alert')).toContainText('Problema');
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue('owner@example.com');
    failed = false;
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByRole('status')).toContainText('Se o e-mail estiver cadastrado');
    await page.goto('/#reset-password=local-fixture-token-never-a-real-secret');
    await expect(page.getByRole('heading', { name: 'Redefinir senha' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.getByLabel('Nova senha', { exact: true }).fill('replacement-password');
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('different-password');
    await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.');
    expect(resetPayload).toBeUndefined();
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('replacement-password');
    await page.getByRole('button', { name: 'Redefinir senha', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Senha redefinida');
    expect(resetPayload?.token).toBe('local-fixture-token-never-a-real-secret');
    expect(resetPayload?.password).toBe('replacement-password');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Voltar ao login' }).click();
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });
}
