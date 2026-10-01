import { test, expect } from '@playwright/test';
import type { AdminText, AdminRoute } from '@ecosdelisboa/shared';

const api = process.env.LISBOA_EDITORIAL_API!;
const csv = 'point_name,address,lat_override,lng_override,author_name,content_pt,content_en,content_type,source_work\n'
  + 'Lugar A,Rua A,38.71,-9.14,Autora QA,Primeiro trecho,First passage,prose,Obra A\n'
  + 'Lugar B,Rua B,38.72,-9.13,Autora QA,Segundo trecho,Second passage,prose,Obra B\n';
// Signature/storage fixture only: this is deliberately not a playable codec sample.
const mp3 = { name: 'manual.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00first-audio', 'binary') };

const width = Number(process.env.LISBOA_EDITORIAL_WIDTH);
test(`CSV review manual audio and PT EN route publication use the migrated backend at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width < 821 ? 844 : 768 });
  const appErrors: string[] = [];
  const apiFailures: string[] = [];
  const generationRequests: string[] = [];
  page.on('pageerror', error => appErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(`${api}/api/`) && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('request', request => {
    if (request.method() !== 'GET' && /\/generate(?:\?|$)|\/batches(?:\?|$)/.test(request.url())) generationRequests.push(new URL(request.url()).pathname);
  });
  // Only map tiles/style are doubled. Editorial/auth/readiness/media requests are real.
  await page.route('https://demotiles.maplibre.org/**', route => route.fulfill({ json: { version: 8, sources: {}, layers: [] } }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('admin@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('secret');
  const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const token = (await (await loginResponse).json()).data.access_token;
  const headers = { Authorization: `Bearer ${token}` };
  const read = async <T,>(path: string): Promise<T> => {
    const response = await page.request.get(`${api}${path}`, { headers });
    expect(response.status()).toBe(200);
    return (await response.json()).data;
  };

  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const upload = page.getByLabel('Arquivo CSV', { exact: true });
  await upload.setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(csv + 'Inválido,Rua C,38.73,-9.12,Autora QA,,Missing,prose,Obra C\n') });
  await page.getByRole('button', { name: 'Gerar preview', exact: true }).click();
  await expect(page.locator('.import-preview')).toContainText('content_pt is required');
  await expect(page.getByRole('button', { name: 'Confirmar importação', exact: true })).toBeDisabled();
  expect(await read<AdminText[]>('/api/v1/admin/texts')).toEqual([]);
  await upload.setInputFiles({ name: 'journey.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Gerar preview', exact: true }).click();
  await expect(page.locator('.import-preview tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(page.locator('.import-summary')).toContainText('2 criados');
  const texts = await read<AdminText[]>('/api/v1/admin/texts');
  expect(texts).toHaveLength(2);

  for (const text of texts) {
    await page.goto(`/#/texts/${text.id}?lang=en`);
    await expect(page.getByRole('textbox', { name: 'Conteúdo EN', exact: true })).toBeEnabled();
    await expect(page.locator('.version-meta').filter({ hasText: 'Estado guardado' })).toContainText('Pendente');
    await page.getByRole('button', { name: 'Aprovar e próximo', exact: true }).click();
    await expect(page.getByText('Revisão guardada.', { exact: true })).toBeVisible();
    for (const lang of ['pt', 'en']) {
      await page.getByRole('tab', { name: new RegExp(`^${lang.toUpperCase()}`) }).click();
      const disclosure = page.locator('.audio-disclosure');
      if (!(await disclosure.evaluate(element => (element as HTMLDetailsElement).open))) await disclosure.locator('summary').click();
      await page.getByLabel('MP3 manual', { exact: true }).setInputFiles(mp3);
      await page.getByRole('button', { name: 'Enviar MP3', exact: true }).click();
      await expect(page.getByText('Áudio manual enviado.', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Gerar áudio IA', exact: true })).toBeDisabled();
      const source = await page.locator('.admin-audio-player').getAttribute('src');
      const media = await page.request.get(source!);
      expect(media.status()).toBe(200);
      expect(await media.body()).toEqual(mp3.buffer);
    }
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  }

  await page.getByRole('button', { name: 'Percursos', exact: true }).click();
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  await page.getByLabel('Título em português', { exact: true }).fill('Jornada no navegador');
  await page.getByRole('textbox', { name: 'Descrição', exact: true }).fill('Percurso local isolado.');
  await page.locator('.available-text-card').filter({ hasText: 'Obra A' }).click();
  await page.getByRole('button', { name: '+ Ponte curatorial', exact: true }).click();
  await page.locator('.narrative-card.bridge textarea').fill('Entre os dois lugares.');
  await page.locator('.available-text-card').filter({ hasText: 'Obra B' }).click();
  await page.getByRole('button', { name: 'Guardar percurso', exact: true }).click();
  await expect(page.getByText('Percurso guardado no servidor.', { exact: true })).toBeVisible();
  let route = (await read<AdminRoute[]>('/api/v1/admin/routes'))[0];
  expect(route.is_published).toBe(false);
  const publish = page.getByRole('button', { name: 'Publicar percurso', exact: true });
  await expect(publish).toBeDisabled();
  await expect(page.locator('.route-readiness-card')).toContainText('Traduzir ponte');

  await page.getByLabel('Título EN', { exact: true }).fill('Browser journey');
  await page.getByRole('textbox', { name: 'Descrição EN', exact: true }).fill('Isolated local route.');
  await page.getByRole('button', { name: 'Rever e guardar metadados EN', exact: true }).click();
  await expect(page.getByText('Metadados EN revistos e guardados.', { exact: true })).toBeVisible();
  await page.locator('.narrative-card.bridge').click();
  const english = page.getByRole('textbox', { name: 'Texto em inglês', exact: true });
  await expect(english).toBeEnabled();
  await english.fill('Between the two places.');
  await page.getByRole('button', { name: 'Rever e guardar EN', exact: true }).click();
  await expect(page.getByText('Ponte EN revista e guardada.', { exact: true })).toBeVisible();
  for (const lang of ['pt', 'en']) {
    await page.getByLabel(`Enviar MP3 ${lang.toUpperCase()} da ponte selecionada`, { exact: true }).setInputFiles(mp3);
    await expect(page.locator('.route-bridge-editorial-card').getByRole('status').filter({ hasText: `Áudio manual ${lang.toUpperCase()} guardado e protegido.` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Recalcular caminhada', exact: true }).click();
  await expect(page.getByText('Rota pedonal recalculada e guardada.', { exact: true })).toBeVisible();
  await expect(publish).toBeEnabled();
  const readiness = await read<{ ready: boolean; issues: unknown[] }>(`/api/v1/admin/routes/${route.id}/readiness?lang=en`);
  expect(readiness).toMatchObject({ ready: true, issues: [] });
  const dialog = page.waitForEvent('dialog');
  const publishing = publish.click();
  await (await dialog).accept();
  await publishing;
  await expect(page.getByRole('button', { name: 'Retirar de publicação', exact: true })).toBeEnabled();
  route = (await read<AdminRoute[]>('/api/v1/admin/routes'))[0];
  expect(route.is_published).toBe(true);
  expect(route.segments).toHaveLength(3);
  for (const segment of route.segments) {
    const audios = segment.kind === 'text' ? segment.text?.audio_files : segment.audio_files;
    expect(audios).toHaveLength(2);
    expect(audios?.every(audio => audio.manually_uploaded)).toBe(true);
  }
  const publicRoute = await page.request.get(`${api}/api/v1/routes/${route.id}?lang=en`);
  expect(publicRoute.status()).toBe(200);
  expect((await publicRoute.json()).data.segments).toHaveLength(3);
  // Route preview must resolve relative media on the API origin, just like the text editor.
  for (const segment of ['text', 'bridge']) {
    await page.locator(`.narrative-card.${segment}`).first().click();
    for (const lang of ['pt', 'en']) {
      await page.locator('.route-preview-card select').selectOption(lang);
      const source = await page.locator('.route-preview-card audio').getAttribute('src');
      expect(new URL(source!, page.url()).origin).toBe(api);
      const media = await page.request.get(new URL(source!, page.url()).href);
      expect(media.status()).toBe(200);
      expect(await media.body()).toEqual(mp3.buffer);
    }
  }
  expect(appErrors).toEqual([]);
  expect(apiFailures).toEqual([]);
  expect(generationRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('published.png'), fullPage: true });
});
