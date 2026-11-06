import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useProjectEditor } from './hooks/use-project-editor';
import type { ProjectEditor } from './hooks/use-project-editor';

vi.mock('./hooks/use-project-editor');

function makeEditor(patch: Partial<ProjectEditor> = {}): ProjectEditor {
  return {
    project: null,
    takes: [],
    status: 'idle',
    error: null,
    isDirty: false,
    savedMessage: null,
    submitScript: vi.fn(),
    updateTake: vi.fn(),
    addTake: vi.fn(),
    removeTake: vi.fn(),
    saveTakes: vi.fn(),
    ...patch,
  };
}

const project = {
  id: 'p1',
  createdAt: '2026-01-01T00:00:00Z',
  scriptText: 'roteiro',
  takes: [],
  interpretationError: null,
  takeErrors: [],
};

describe('App', () => {
  beforeEach(() => {
    vi.mocked(useProjectEditor).mockReturnValue(makeEditor());
  });

  it('mostra o título do app', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Storytelling Video Editor' })).toBeDefined();
  });

  it('sem projeto mostra o formulário', () => {
    render(<App />);

    expect(screen.getByLabelText('Roteiro')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Salvar takes' })).toBeNull();
  });

  it('com interpretationError mostra o alerta e a tabela', () => {
    vi.mocked(useProjectEditor).mockReturnValue(
      makeEditor({ project: { ...project, interpretationError: 'Não entendi o roteiro.' } }),
    );
    render(<App />);

    expect(screen.getByRole('alert').textContent).toBe('Não entendi o roteiro.');
    expect(screen.getByRole('button', { name: 'Adicionar take' })).toBeDefined();
    expect(screen.queryByLabelText('Roteiro')).toBeNull();
  });

  it('mostra erro de rede e mensagem de salvo', () => {
    vi.mocked(useProjectEditor).mockReturnValue(
      makeEditor({ project, error: 'Falha de rede.', savedMessage: 'Takes salvos.' }),
    );
    render(<App />);

    expect(screen.getByRole('alert').textContent).toBe('Falha de rede.');
    expect(screen.getByRole('status').textContent).toBe('Takes salvos.');
  });
});
