import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClipsFolderForm } from './ClipsFolderForm';

describe('ClipsFolderForm', () => {
  it('começa com a pasta inicial', () => {
    render(<ClipsFolderForm initialFolder="D:\clipes" isScanning={false} onSubmit={vi.fn()} />);

    expect((screen.getByLabelText('Pasta dos clipes') as HTMLInputElement).value).toBe(
      'D:\\clipes',
    );
  });

  it('chama onSubmit com o texto digitado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ClipsFolderForm initialFolder="" isScanning={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('Pasta dos clipes'), 'D:\\videos');
    await user.click(screen.getByRole('button', { name: 'Ler clipes' }));

    expect(onSubmit).toHaveBeenCalledWith('D:\\videos');
  });

  it('desabilita o botão com o campo vazio ou só espaços', async () => {
    const user = userEvent.setup();
    render(<ClipsFolderForm initialFolder="" isScanning={false} onSubmit={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Ler clipes' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    await user.type(screen.getByLabelText('Pasta dos clipes'), '   ');
    expect(button.disabled).toBe(true);
  });

  it('desabilita o botão e mostra "Lendo clipes…" enquanto lê', () => {
    render(<ClipsFolderForm initialFolder="D:\clipes" isScanning={true} onSubmit={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Lendo clipes…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
