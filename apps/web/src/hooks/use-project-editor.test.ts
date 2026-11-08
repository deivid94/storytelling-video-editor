import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createProject, scanClips, updateTakes } from '../api/projects';
import type { ProjectView, ScriptTake } from '../api/projects';
import { createEmptyTake } from '../lib/takes';
import { useProjectEditor } from './use-project-editor';

vi.mock('../api/projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/projects')>();
  return { ...original, createProject: vi.fn(), updateTakes: vi.fn(), scanClips: vi.fn() };
});

const createProjectMock = vi.mocked(createProject);
const updateTakesMock = vi.mocked(updateTakes);
const scanClipsMock = vi.mocked(scanClips);

function makeTake(number: number, name: string): ScriptTake {
  return { ...createEmptyTake(number), name };
}

function makeProject(takes: ScriptTake[]): ProjectView {
  return {
    id: 'p1',
    createdAt: '2026-11-06T00:00:00.000Z',
    scriptText: 'roteiro',
    takes,
    interpretationError: null,
    takeErrors: [],
    clipMapping: null,
  };
}

async function renderWithProject(takes: ScriptTake[]) {
  createProjectMock.mockResolvedValue(makeProject(takes));
  const hook = renderHook(() => useProjectEditor());
  await act(() => hook.result.current.submitScript('roteiro'));
  return hook;
}

describe('useProjectEditor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('começa sem projeto e parado', () => {
    const { result } = renderHook(() => useProjectEditor());

    expect(result.current.project).toBeNull();
    expect(result.current.takes).toEqual([]);
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.isDirty).toBe(false);
    expect(result.current.savedMessage).toBeNull();
  });

  it('submitScript passa por loading e guarda o projeto e os takes', async () => {
    const project = makeProject([makeTake(1, 'Abertura')]);
    let resolve!: (value: ProjectView) => void;
    createProjectMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useProjectEditor());

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.submitScript('roteiro');
    });
    expect(result.current.status).toBe('loading');

    await act(async () => {
      resolve(project);
      await pending;
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.project).toEqual(project);
    expect(result.current.takes).toEqual(project.takes);
  });

  it('submitScript guarda a mensagem do ApiError em error e volta para idle', async () => {
    createProjectMock.mockRejectedValue(new ApiError(400, 'Roteiro vazio.'));
    const { result } = renderHook(() => useProjectEditor());

    await act(() => result.current.submitScript(''));

    expect(result.current.error).toBe('Roteiro vazio.');
    expect(result.current.status).toBe('idle');
    expect(result.current.project).toBeNull();
  });

  it('submitScript usa uma mensagem genérica para erros inesperados', async () => {
    createProjectMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useProjectEditor());

    await act(() => result.current.submitScript('x'));

    expect(result.current.error).toBe('Erro inesperado. Tente de novo.');
  });

  it('submitScript ignora uma segunda chamada enquanto a primeira carrega', async () => {
    createProjectMock.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProjectEditor());

    act(() => {
      void result.current.submitScript('a');
      void result.current.submitScript('b');
    });

    expect(createProjectMock).toHaveBeenCalledTimes(1);
  });

  it('updateTake altera só o take do índice e marca isDirty', async () => {
    const { result } = await renderWithProject([makeTake(1, 'A'), makeTake(2, 'B')]);

    act(() => result.current.updateTake(1, { name: 'Novo' }));

    expect(result.current.takes.map((t) => t.name)).toEqual(['A', 'Novo']);
    expect(result.current.isDirty).toBe(true);
  });

  it('addTake adiciona um take em branco no fim com o próximo número', async () => {
    const { result } = await renderWithProject([makeTake(1, 'A')]);

    act(() => result.current.addTake());

    expect(result.current.takes).toHaveLength(2);
    expect(result.current.takes[1]).toEqual(createEmptyTake(2));
    expect(result.current.isDirty).toBe(true);
  });

  it('removeTake remove e renumera', async () => {
    const { result } = await renderWithProject([
      makeTake(1, 'A'),
      makeTake(2, 'B'),
      makeTake(3, 'C'),
    ]);

    act(() => result.current.removeTake(0));

    expect(result.current.takes.map((t) => [t.number, t.name])).toEqual([
      [1, 'B'],
      [2, 'C'],
    ]);
  });

  it('saveTakes manda os takes sem o campo number, atualiza o projeto, limpa isDirty e mostra "Takes salvos."', async () => {
    const { result } = await renderWithProject([makeTake(1, 'A')]);
    act(() => result.current.updateTake(0, { name: 'Editado' }));
    const saved = makeProject([makeTake(1, 'Editado')]);
    updateTakesMock.mockResolvedValue(saved);

    await act(() => result.current.saveTakes());

    const sent = updateTakesMock.mock.calls[0]?.[1];
    expect(updateTakesMock.mock.calls[0]?.[0]).toBe('p1');
    expect(sent?.[0]).not.toHaveProperty('number');
    expect(sent?.[0]?.name).toBe('Editado');
    expect(result.current.project).toEqual(saved);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.savedMessage).toBe('Takes salvos.');
    expect(result.current.status).toBe('idle');
  });

  it('saveTakes com erro mantém as edições locais e isDirty', async () => {
    const { result } = await renderWithProject([makeTake(1, 'A')]);
    act(() => result.current.updateTake(0, { name: 'Editado' }));
    updateTakesMock.mockRejectedValue(new ApiError(0, 'Sem conexão com o servidor.'));

    await act(() => result.current.saveTakes());

    expect(result.current.error).toBe('Sem conexão com o servidor.');
    expect(result.current.takes[0]?.name).toBe('Editado');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.savedMessage).toBeNull();
  });

  it('editar depois de salvar apaga savedMessage', async () => {
    const { result } = await renderWithProject([makeTake(1, 'A')]);
    updateTakesMock.mockResolvedValue(makeProject([makeTake(1, 'A')]));
    await act(() => result.current.saveTakes());
    expect(result.current.savedMessage).toBe('Takes salvos.');

    act(() => result.current.updateTake(0, { name: 'B' }));

    expect(result.current.savedMessage).toBeNull();
  });

  describe('scanClips', () => {
    const mapping = {
      folder: 'D:\\v',
      scannedAt: '2026-11-07T00:00:00.000Z',
      takes: [],
      orphanClips: [],
      ignoredFiles: [],
      notices: [],
    };

    it('atualiza clipMapping e mantém os takes editados', async () => {
      const { result } = await renderWithProject([makeTake(1, 'A')]);
      act(() => result.current.updateTake(0, { name: 'Editado' }));
      scanClipsMock.mockResolvedValue({ ...makeProject([makeTake(1, 'A')]), clipMapping: mapping });

      await act(() => result.current.scanClips('D:\\v'));

      expect(scanClipsMock).toHaveBeenCalledWith('p1', 'D:\\v');
      expect(result.current.project?.clipMapping).toEqual(mapping);
      expect(result.current.takes[0]?.name).toBe('Editado');
      expect(result.current.isDirty).toBe(true);
    });

    it('mostra o erro quando falha', async () => {
      const { result } = await renderWithProject([makeTake(1, 'A')]);
      scanClipsMock.mockRejectedValue(new ApiError(400, 'Pasta não encontrada.'));

      await act(() => result.current.scanClips('x'));

      expect(result.current.error).toBe('Pasta não encontrada.');
      expect(result.current.status).toBe('idle');
    });

    it('ignora a segunda chamada durante a primeira e usa status scanning', async () => {
      const { result } = await renderWithProject([makeTake(1, 'A')]);
      let resolve!: (value: ProjectView) => void;
      scanClipsMock.mockReturnValue(new Promise((r) => (resolve = r)));

      let first!: Promise<void>;
      act(() => {
        first = result.current.scanClips('a');
        void result.current.scanClips('b');
      });
      expect(result.current.status).toBe('scanning');
      await act(async () => {
        resolve(makeProject([makeTake(1, 'A')]));
        await first;
      });

      expect(scanClipsMock).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('idle');
    });

    it('sem projeto não chama a API', async () => {
      const { result } = renderHook(() => useProjectEditor());

      await act(() => result.current.scanClips('x'));

      expect(scanClipsMock).not.toHaveBeenCalled();
    });
  });
});
