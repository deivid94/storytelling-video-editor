import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ScriptTake } from '../api/projects';
import { TakesTable } from './TakesTable';

function makeTake(number: number): ScriptTake {
  return {
    number,
    name: `Nome ${number}`,
    minSeconds: 1,
    maxSeconds: 2,
    action: `Ação ${number}`,
    framing: null,
    lens: null,
    distance: null,
    angle: null,
    hasExecution: false,
    notes: [],
  };
}

function renderTable(props: Partial<ComponentProps<typeof TakesTable>> = {}) {
  const handlers = {
    onChange: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onSave: vi.fn(),
  };
  render(
    <TakesTable
      takes={[makeTake(1), makeTake(2)]}
      takeErrors={[]}
      isSaving={false}
      isDirty={true}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function isDisabled(element: HTMLElement) {
  return element.matches(':disabled');
}

describe('TakesTable', () => {
  it('mostra uma linha por take com os valores', () => {
    renderTable();

    const take2 = within(screen.getByRole('group', { name: 'Take 2' }));
    expect((take2.getByLabelText('Nome') as HTMLInputElement).value).toBe('Nome 2');
    expect((take2.getByLabelText('Duração mínima (s)') as HTMLInputElement).value).toBe('1');
    expect((take2.getByLabelText('Ação') as HTMLInputElement).value).toBe('Ação 2');
    expect(screen.getAllByRole('group')).toHaveLength(2);
  });

  it('duração digitada com vírgula chama onChange com número', async () => {
    const user = userEvent.setup();
    const { onChange } = renderTable();
    const input = within(screen.getByRole('group', { name: 'Take 1' })).getByLabelText(
      'Duração máxima (s)',
    );

    await user.clear(input);
    await user.type(input, '2,5');

    expect(onChange).toHaveBeenLastCalledWith(0, { maxSeconds: 2.5 });
  });

  it('duração inválida chama onChange com 0', async () => {
    const user = userEvent.setup();
    const { onChange } = renderTable();
    const input = within(screen.getByRole('group', { name: 'Take 1' })).getByLabelText(
      'Duração mínima (s)',
    );

    await user.clear(input);
    await user.type(input, 'abc');

    expect(onChange).toHaveBeenLastCalledWith(0, { minSeconds: 0 });
  });

  it('notas: uma por linha, linhas vazias ignoradas', async () => {
    const user = userEvent.setup();
    const { onChange } = renderTable();
    const notes = within(screen.getByRole('group', { name: 'Take 1' })).getByLabelText('Notas');

    await user.type(notes, 'primeira{Enter}{Enter}segunda');

    expect(onChange).toHaveBeenLastCalledWith(0, { notes: ['primeira', 'segunda'] });
  });

  it('enquadramento e tem execução chamam onChange', async () => {
    const user = userEvent.setup();
    const { onChange } = renderTable();
    const take1 = within(screen.getByRole('group', { name: 'Take 1' }));

    await user.selectOptions(take1.getByLabelText('Enquadramento'), 'Médio');
    expect(onChange).toHaveBeenLastCalledWith(0, { framing: 'medium' });

    await user.click(take1.getByLabelText('Tem execução'));
    expect(onChange).toHaveBeenLastCalledWith(0, { hasExecution: true });
  });

  it('mostra o erro do take embaixo do campo certo', () => {
    renderTable({
      takeErrors: [{ takeNumber: 2, field: 'maxSeconds', message: 'Máximo menor que o mínimo.' }],
    });

    const take2 = within(screen.getByRole('group', { name: 'Take 2' }));
    const errorId = take2.getByLabelText('Duração máxima (s)').getAttribute('aria-describedby');
    expect(errorId).not.toBeNull();
    expect(document.getElementById(errorId ?? '')?.textContent).toBe('Máximo menor que o mínimo.');
    expect(take2.getByLabelText('Duração mínima (s)').getAttribute('aria-describedby')).toBeNull();
    expect(within(screen.getByRole('group', { name: 'Take 1' })).queryByText(/Máximo/)).toBeNull();
  });

  it('"Salvar takes" fica desabilitado sem alterações', () => {
    renderTable({ isDirty: false });

    expect(isDisabled(screen.getByRole('button', { name: 'Salvar takes' }))).toBe(true);
  });

  it('enquanto salva, desabilita botões e campos', () => {
    renderTable({ isSaving: true, isDirty: true });

    expect(isDisabled(screen.getByRole('button', { name: 'Salvar takes' }))).toBe(true);
    expect(isDisabled(screen.getByRole('button', { name: 'Adicionar take' }))).toBe(true);
    expect(isDisabled(screen.getByRole('button', { name: 'Remover take 1' }))).toBe(true);
    expect(isDisabled(screen.getAllByLabelText('Nome')[0] as HTMLElement)).toBe(true);
  });

  it('"Salvar takes" chama onSave quando há alterações', async () => {
    const user = userEvent.setup();
    const { onSave } = renderTable();

    await user.click(screen.getByRole('button', { name: 'Salvar takes' }));

    expect(onSave).toHaveBeenCalledOnce();
  });

  it('"Remover take 2" chama onRemove(1)', async () => {
    const user = userEvent.setup();
    const { onRemove } = renderTable();

    await user.click(screen.getByRole('button', { name: 'Remover take 2' }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('sem takes mostra só "Adicionar take"', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderTable({ takes: [], isDirty: false });

    expect(screen.queryAllByRole('group')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Adicionar take' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
