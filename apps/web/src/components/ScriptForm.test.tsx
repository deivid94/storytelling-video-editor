import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScriptForm } from './ScriptForm';

describe('ScriptForm', () => {
  it('desabilita o botão com texto vazio ou só espaços', async () => {
    const user = userEvent.setup();
    render(<ScriptForm onSubmit={vi.fn()} isLoading={false} />);
    const button = screen.getByRole('button', { name: 'Interpretar roteiro' });

    expect((button as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText('Roteiro'), '   ');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('desabilita o botão e mostra "Interpretando…" enquanto carrega', () => {
    render(<ScriptForm onSubmit={vi.fn()} isLoading={true} />);

    const button = screen.getByRole('button', { name: 'Interpretando…' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('chama onSubmit com o texto digitado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ScriptForm onSubmit={onSubmit} isLoading={false} />);

    await user.type(screen.getByLabelText('Roteiro'), 'Take 1: abertura');
    await user.click(screen.getByRole('button', { name: 'Interpretar roteiro' }));

    expect(onSubmit).toHaveBeenCalledWith('Take 1: abertura');
  });

  it('mostra o contador de caracteres', async () => {
    const user = userEvent.setup();
    render(<ScriptForm onSubmit={vi.fn()} isLoading={false} />);

    expect(screen.getByText('0 / 20.000')).toBeDefined();
    await user.type(screen.getByLabelText('Roteiro'), 'abc');
    expect(screen.getByText('3 / 20.000')).toBeDefined();
  });
});
