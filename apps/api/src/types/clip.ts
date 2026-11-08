export interface VideoInfo {
  durationSeconds: number;
  width: number; // já com a rotação aplicada
  height: number; // já com a rotação aplicada
  fps: number;
  lensType: string | null; // com.blackmagic-design.camera.lensType
}

export interface ScannedClip {
  fileName: string;
  takeNumber: number;
  attempt: string | null; // letra minúscula: 'a', 'b'...; null em "take3.mov"
  video: VideoInfo | null; // null quando o arquivo não pôde ser lido
  readError: string | null; // mensagem do VideoProbeError quando video é null
}

export interface IgnoredFile {
  fileName: string;
  reason: string;
}

export interface ClipScan {
  folder: string;
  scannedAt: string; // ISO 8601
  clips: ScannedClip[];
  ignoredFiles: IgnoredFile[];
}

export type ClipWarningCode = 'unreadable' | 'too-short' | 'lens-mismatch';
export type TakeClipsWarningCode = 'missing' | 'no-readable-clip' | 'attempt-gap' | 'duplicate';

export interface ClipWarning {
  code: ClipWarningCode;
  message: string;
}
export interface TakeClipsWarning {
  code: TakeClipsWarningCode;
  message: string;
}

export interface MappedClip extends ScannedClip {
  warnings: ClipWarning[];
}

export interface TakeClips {
  takeNumber: number;
  clips: MappedClip[];
  warnings: TakeClipsWarning[];
}

export interface ClipMapping {
  folder: string;
  scannedAt: string;
  takes: TakeClips[]; // um por take do roteiro, na ordem do roteiro
  orphanClips: MappedClip[]; // clipes cujo número não existe no roteiro
  ignoredFiles: IgnoredFile[];
  notices: string[]; // avisos gerais (resolução baixa, pasta sem clipes)
}
