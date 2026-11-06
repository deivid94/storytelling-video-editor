import { expect, test } from '@playwright/test';

test('a página inicial mostra o nome do app', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Storytelling Video Editor' })).toBeVisible();
});
