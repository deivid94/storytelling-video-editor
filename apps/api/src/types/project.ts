import type { ClipMapping, ClipScan } from './clip.js';

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
  notes: string[]; // instruções que o MVP não executa, ex.: "desacelere 30-50%"
}

export type InterpretedTake = Omit<ScriptTake, 'number'>;

export interface TakeError {
  takeNumber: number;
  field: keyof ScriptTake;
  message: string;
}

export interface Project {
  id: string;
  createdAt: string; // ISO 8601
  scriptText: string;
  takes: ScriptTake[];
  interpretationError: string | null;
  clipScan: ClipScan | null; // última leitura da pasta de clipes; null enquanto não houve
}

// O clipScan bruto não sai da API: o clipMapping já traz tudo que a tela usa.
export interface ProjectView extends Omit<Project, 'clipScan'> {
  takeErrors: TakeError[];
  clipMapping: ClipMapping | null; // calculado a cada resposta a partir dos takes e do clipScan
}
