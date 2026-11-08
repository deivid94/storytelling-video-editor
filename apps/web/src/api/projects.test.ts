import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createProject, getProject, scanClips, updateTakes } from './projects';
import type { ProjectView } from './projects';

const view: ProjectView = {
  id: 'p1',
  createdAt: '2026-11-06T00:00:00.000Z',
  scriptText: 'roteiro',
  takes: [],
  interpretationError: null,
  takeErrors: [],
  clipMapping: null,
};

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('createProject', () => {
  it('faz POST /api/projects com o texto', async () => {
    fetchMock.mockResolvedValue(jsonResponse(view, 201));

    const result = await createProject('roteiro');

    expect(result).toEqual(view);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptText: 'roteiro' }),
    });
  });

  it('lança ApiError com a mensagem do servidor', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'O roteiro está vazio.' }, 400));

    await expect(createProject(' ')).rejects.toThrow(new ApiError(400, 'O roteiro está vazio.'));
  });
});

describe('getProject', () => {
  it('faz GET e devolve o projeto', async () => {
    fetchMock.mockResolvedValue(jsonResponse(view));

    await expect(getProject('p1')).resolves.toEqual(view);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1', undefined);
  });

  it('codifica o id na URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse(view));

    await getProject('a/b');

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/a%2Fb', undefined);
  });

  it('lança ApiError genérico quando o servidor não manda JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }));

    await expect(getProject('x')).rejects.toThrow(
      new ApiError(502, 'Erro ao falar com o servidor.'),
    );
  });

  it('lança ApiError quando não há conexão', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getProject('x')).rejects.toThrow(new ApiError(0, 'Sem conexão com o servidor.'));
  });

  it('expõe o status no ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Projeto não encontrado.' }, 404));

    await expect(getProject('x')).rejects.toMatchObject({ status: 404 });
  });
});

describe('updateTakes', () => {
  it('faz PUT /api/projects/:id/takes com os takes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(view));

    await updateTakes('p1', []);

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/p1/takes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ takes: [] }),
    });
  });
});

describe('scanClips', () => {
  it('faz PUT /api/projects/:id/clips-folder com a pasta', async () => {
    fetchMock.mockResolvedValue(jsonResponse(view));

    const result = await scanClips('abc', 'D:\\v');

    expect(result).toEqual(view);
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/abc/clips-folder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{"folder":"D:\\\\v"}',
    });
  });

  it('erro 400 vira ApiError com a mensagem do corpo', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Pasta não encontrada.' }, 400));

    await expect(scanClips('abc', 'x')).rejects.toThrow(new ApiError(400, 'Pasta não encontrada.'));
  });
});
