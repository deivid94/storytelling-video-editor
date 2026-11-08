import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SCRIPT = 'Chegada (2-3s): plano largo\nSérie (4-6s): plano médio';
const CLIPS_FOLDER = path.resolve('fixtures/videos/clips-e2e');

async function interpretScript(page: Page, text: string) {
  await page.goto('/');
  await page.getByLabel('Roteiro').fill(text);
  await page.getByRole('button', { name: 'Interpretar roteiro' }).click();
}

test('lê a pasta e mostra os avisos por take', async ({ page }) => {
  await interpretScript(page, SCRIPT);
  await page.getByLabel('Pasta dos clipes').fill(CLIPS_FOLDER);
  await page.getByRole('button', { name: 'Ler clipes' }).click();

  const take1 = page.getByRole('group', { name: 'Clipes do take 1' });
  await expect(
    take1.getByText('Lente do clipe (52mm) diferente da do roteiro (24mm).'),
  ).toBeVisible();
  await expect(take1.getByText('O clipe tem 1,5s, menos que o mínimo do take (2s).')).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Clipes do take 2' }).getByText('Tentativa faltando: take2b.'),
  ).toBeVisible();
  await expect(page.getByText('take9.mp4')).toBeVisible();
  await expect(page.getByText('1 arquivo(s) ignorado(s)')).toBeVisible();
});

test('pasta que não existe mostra o erro', async ({ page }) => {
  await interpretScript(page, SCRIPT);
  await page.getByLabel('Pasta dos clipes').fill(path.resolve('fixtures/nao-existe'));
  await page.getByRole('button', { name: 'Ler clipes' }).click();
  await expect(page.getByRole('alert')).toHaveText('A pasta não existe.');
});
