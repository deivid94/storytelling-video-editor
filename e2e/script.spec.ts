import { expect, test, type Page } from '@playwright/test';

const SCRIPT = 'Chegada (2-3s): plano largo\nSérie (4-6s): plano médio';

async function interpretScript(page: Page, text: string) {
  await page.goto('/');
  await page.getByLabel('Roteiro').fill(text);
  await page.getByRole('button', { name: 'Interpretar roteiro' }).click();
}

const take = (page: Page, n: number) => page.getByRole('group', { name: `Take ${n}`, exact: true });

test('interpreta o roteiro e mostra os takes', async ({ page }) => {
  await interpretScript(page, SCRIPT);

  await expect(take(page, 1).getByLabel('Nome')).toHaveValue('Chegada');
  await expect(take(page, 2).getByLabel('Nome')).toHaveValue('Série pesada');
});

test('salva edição e mostra erro de regra', async ({ page }) => {
  await interpretScript(page, SCRIPT);
  await expect(take(page, 1).getByLabel('Nome')).toHaveValue('Chegada');

  await take(page, 1).getByLabel('Duração máxima (s)').fill('1');
  await page.getByRole('button', { name: 'Salvar takes' }).click();

  await expect(page.getByText('A duração máxima não pode ser menor que a mínima.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Takes salvos.');
});

test('roteiro sem takes permite preencher à mão', async ({ page }) => {
  await interpretScript(page, '[sem-takes] meu roteiro');

  await expect(page.getByRole('alert')).toHaveText(
    'Nenhum take encontrado no roteiro. Preencha os takes à mão.',
  );
  await page.getByRole('button', { name: 'Adicionar take' }).click();
  await expect(take(page, 1)).toBeVisible();
});

test('falha da IA mostra o aviso', async ({ page }) => {
  await interpretScript(page, '[erro-ia] meu roteiro');

  await expect(page.getByRole('alert')).toHaveText(
    'Não foi possível interpretar o roteiro. Preencha os takes à mão.',
  );
});
