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
    scanClips: vi.fn(),
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
  clipMapping: null,
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

  it('sem projeto mostra o erro e mantém o formulário', () => {
    vi.mocked(useProjectEditor).mockReturnValue(
      makeEditor({ error: 'Sem conexão com o servidor.' }),
    );
    render(<App />);

    expect(screen.getByRole('alert').textContent).toBe('Sem conexão com o servidor.');
    expect(screen.getByLabelText('Roteiro')).toBeDefined();
  });

  it('mostra erro de rede e mensagem de salvo', () => {
    vi.mocked(useProjectEditor).mockReturnValue(
      makeEditor({ project, error: 'Falha de rede.', savedMessage: 'Takes salvos.' }),
    );
    render(<App />);

    expect(screen.getByRole('alert').textContent).toBe('Falha de rede.');
    expect(screen.getByRole('status').textContent).toBe('Takes salvos.');
  });

  describe('clipes', () => {
    const clipMapping = {
      folder: 'D:\\clipes',
      scannedAt: '2026-01-01T00:00:00Z',
      takes: [{ takeNumber: 1, clips: [], warnings: [] }],
      orphanClips: [],
      ignoredFiles: [],
      notices: [],
    };
    const saveNote = 'Salve os takes para atualizar os avisos dos clipes.';

    it('depois de interpretar o roteiro aparece o campo da pasta', () => {
      vi.mocked(useProjectEditor).mockReturnValue(makeEditor({ project }));
      render(<App />);

      expect(screen.getByLabelText('Pasta dos clipes')).toBeDefined();
      expect(screen.queryByRole('group', { name: 'Clipes do take 1' })).toBeNull();
    });

    it('com mapeamento mostra o grupo do take', () => {
      vi.mocked(useProjectEditor).mockReturnValue(
        makeEditor({ project: { ...project, clipMapping } }),
      );
      render(<App />);

      expect(screen.getByRole('group', { name: 'Clipes do take 1' })).toBeDefined();
      expect(screen.queryByText(saveNote)).toBeNull();
    });

    it('com edição local pendente aparece a nota de salvar', () => {
      vi.mocked(useProjectEditor).mockReturnValue(
        makeEditor({ project: { ...project, clipMapping }, isDirty: true }),
      );
      render(<App />);

      expect(screen.getByText(saveNote)).toBeDefined();
    });

    it('sem mapeamento a nota de salvar não aparece', () => {
      vi.mocked(useProjectEditor).mockReturnValue(makeEditor({ project, isDirty: true }));
      render(<App />);

      expect(screen.queryByText(saveNote)).toBeNull();
    });
  });

  describe('erros de regra por take', () => {
    const take = {
      number: 1,
      name: 'Abertura',
      minSeconds: 1,
      maxSeconds: 2,
      action: 'Ação',
      framing: null,
      lens: null,
      distance: null,
      angle: null,
      hasExecution: false,
      notes: [],
    };
    const takeErrors = [{ takeNumber: 1, field: 'name' as const, message: 'Nome inválido.' }];

    it('mostra os erros quando não há edição pendente', () => {
      vi.mocked(useProjectEditor).mockReturnValue(
        makeEditor({ project: { ...project, takeErrors }, takes: [take], isDirty: false }),
      );
      render(<App />);

      expect(screen.getByText('Nome inválido.')).toBeDefined();
    });

    it('esconde os erros salvos enquanto há edição pendente', () => {
      vi.mocked(useProjectEditor).mockReturnValue(
        makeEditor({ project: { ...project, takeErrors }, takes: [take], isDirty: true }),
      );
      render(<App />);

      expect(screen.queryByText('Nome inválido.')).toBeNull();
    });
  });
});
