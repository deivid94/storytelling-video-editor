import { useRef, useState } from 'react';
import {
  ApiError,
  createProject,
  scanClips as scanClipsRequest,
  updateTakes,
} from '../api/projects';
import type { ProjectView, ScriptTake } from '../api/projects';
import { createEmptyTake, renumberTakes } from '../lib/takes';

export type EditorStatus = 'idle' | 'loading' | 'saving' | 'scanning';

export interface ProjectEditor {
  project: ProjectView | null;
  takes: ScriptTake[]; // cópia local editável
  status: EditorStatus;
  error: string | null; // última falha de rede/servidor
  isDirty: boolean; // takes locais diferentes dos salvos
  savedMessage: string | null; // 'Takes salvos.' depois de salvar
  submitScript(scriptText: string): Promise<void>;
  updateTake(index: number, patch: Partial<Omit<ScriptTake, 'number'>>): void;
  addTake(): void;
  removeTake(index: number): void;
  saveTakes(): Promise<void>;
  scanClips(folder: string): Promise<void>;
}

const SAVED_MESSAGE = 'Takes salvos.';
const UNEXPECTED_ERROR = 'Erro inesperado. Tente de novo.';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_ERROR;
}

function withoutNumber({ number: _number, ...take }: ScriptTake): Omit<ScriptTake, 'number'> {
  return take;
}

export function useProjectEditor(): ProjectEditor {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [takes, setTakes] = useState<ScriptTake[]>([]);
  const [status, setStatus] = useState<EditorStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  // O estado do React ainda não mudou numa segunda chamada síncrona; o ref muda na hora.
  const busy = useRef(false);

  const isDirty = project !== null && JSON.stringify(takes) !== JSON.stringify(project.takes);

  async function runRequest(busyStatus: EditorStatus, request: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setStatus(busyStatus);
    setError(null);
    setSavedMessage(null);
    try {
      await request();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      busy.current = false;
      setStatus('idle');
    }
  }

  function submitScript(scriptText: string) {
    return runRequest('loading', async () => {
      const created = await createProject(scriptText);
      setProject(created);
      setTakes(created.takes);
    });
  }

  function saveTakes() {
    return runRequest('saving', async () => {
      if (project === null) return;
      const saved = await updateTakes(project.id, takes.map(withoutNumber));
      setProject(saved);
      setTakes(saved.takes);
      setSavedMessage(SAVED_MESSAGE);
    });
  }

  function scanClips(folder: string) {
    return runRequest('scanning', async () => {
      if (project === null) return;
      // Só o mapeamento muda: os takes locais (editados ou não) ficam como estão.
      setProject(await scanClipsRequest(project.id, folder));
    });
  }

  function editTakes(change: (current: ScriptTake[]) => ScriptTake[]) {
    setTakes((current) => renumberTakes(change(current)));
    setSavedMessage(null);
  }

  function updateTake(index: number, patch: Partial<Omit<ScriptTake, 'number'>>) {
    editTakes((current) => current.map((take, i) => (i === index ? { ...take, ...patch } : take)));
  }

  function addTake() {
    editTakes((current) => [...current, createEmptyTake(current.length + 1)]);
  }

  function removeTake(index: number) {
    editTakes((current) => current.filter((_, i) => i !== index));
  }

  return {
    project,
    takes,
    status,
    error,
    isDirty,
    savedMessage,
    submitScript,
    updateTake,
    addTake,
    removeTake,
    saveTakes,
    scanClips,
  };
}
