// Tipos iguais aos de apps/api/src/types/project.ts (duplicados de propósito por enquanto).
export type Framing = 'close' | 'medium' | 'wide';

export interface ScriptTake {
  number: number; // ordem no roteiro, começa em 1
  name: string;
  minSeconds: number;
  maxSeconds: number;
  action: string;
  framing: Framing | null;
  lens: string | null;
  distance: string | null;
  angle: string | null;
  hasExecution: boolean;
  notes: string[];
}

export interface TakeError {
  takeNumber: number;
  field: keyof ScriptTake;
  message: string;
}

export interface ProjectView {
  id: string;
  createdAt: string;
  scriptText: string;
  takes: ScriptTake[];
  interpretationError: string | null;
  takeErrors: TakeError[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const GENERIC_ERROR = 'Erro ao falar com o servidor.';
const NETWORK_ERROR = 'Sem conexão com o servidor.';

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const { error } = body;
      if (typeof error === 'string') return error;
    }
  } catch {
    // corpo não era JSON: cai na mensagem genérica
  }
  return GENERIC_ERROR;
}

async function request(url: string, init?: RequestInit): Promise<ProjectView> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as ProjectView;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function createProject(scriptText: string): Promise<ProjectView> {
  return request('/api/projects', jsonRequest('POST', { scriptText }));
}

export function getProject(id: string): Promise<ProjectView> {
  return request(`/api/projects/${encodeURIComponent(id)}`);
}

export function updateTakes(id: string, takes: Omit<ScriptTake, 'number'>[]): Promise<ProjectView> {
  return request(`/api/projects/${encodeURIComponent(id)}/takes`, jsonRequest('PUT', { takes }));
}
