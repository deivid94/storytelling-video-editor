import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/errors/app-error.js';
import {
  buildClipMapping,
  formatSecondsShort,
  lensMillimeters,
  normalizeFolderInput,
} from '../../src/services/clip-rules.js';
import type { ClipScan, ScannedClip, VideoInfo } from '../../src/types/clip.js';
import type { ScriptTake } from '../../src/types/project.js';

function take(number: number, overrides: Partial<ScriptTake> = {}): ScriptTake {
  return {
    number,
    name: `Take ${number}`,
    minSeconds: 4,
    maxSeconds: 6,
    action: 'Ação',
    framing: null,
    lens: null,
    distance: null,
    angle: null,
    hasExecution: false,
    notes: [],
    ...overrides,
  };
}

function video(overrides: Partial<VideoInfo> = {}): VideoInfo {
  return { durationSeconds: 5, width: 1080, height: 1920, fps: 30, lensType: null, ...overrides };
}

function clip(fileName: string, overrides: Partial<ScannedClip> = {}): ScannedClip {
  const match = /^take(\d+)([a-z])?\./i.exec(fileName);
  return {
    fileName,
    takeNumber: Number(match?.[1]),
    attempt: match?.[2] ? match[2].toLowerCase() : null,
    video: video(),
    readError: null,
    ...overrides,
  };
}

function scan(clips: ScannedClip[]): ClipScan {
  return {
    folder: 'D:\\clipes',
    scannedAt: '2026-11-07T10:00:00.000Z',
    clips,
    ignoredFiles: [{ fileName: 'x.txt', reason: 'Extensão não suportada' }],
  };
}

const NO_CLIPS_NOTICE = 'A pasta não tem nenhum clipe com nome take<N> (ex.: take1.mov).';

function errorOf(action: () => unknown): AppError {
  try {
    action();
  } catch (error) {
    return error as AppError;
  }
  throw new Error('Era esperado um erro.');
}

describe('normalizeFolderInput', () => {
  const abs = path.resolve('videos');

  it('tira espaços em volta', () => {
    expect(normalizeFolderInput(`  ${abs}  `)).toBe(abs);
  });

  it('tira um par de aspas duplas', () => {
    expect(normalizeFolderInput(`"${abs}"`)).toBe(abs);
    expect(normalizeFolderInput(`  "${abs}"  `)).toBe(abs);
  });

  it.each(['', '   ', '""'])('texto vazio %j dá erro 400', (text) => {
    const error = errorOf(() => normalizeFolderInput(text));
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Informe a pasta dos clipes.');
  });

  it('caminho relativo dá erro 400', () => {
    const error = errorOf(() => normalizeFolderInput('videos/treino'));
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Use o caminho completo da pasta (ex.: D:\\Videos\\treino).');
  });
});

describe('formatSecondsShort', () => {
  it.each([
    [3.96, '3,9s'],
    [4, '4s'],
    [1.5, '1,5s'],
    [0.04, '0s'],
    [0.3, '0,3s'],
  ])('%s -> %s', (seconds, expected) => {
    expect(formatSecondsShort(seconds)).toBe(expected);
  });
});

describe('lensMillimeters', () => {
  it.each([
    ['52mm', 52],
    ['iPhone 14 Pro Max 24mm', 24],
    ['52 mm', 52],
    ['13,5mm', 13.5],
    ['0.5x', null],
    [null, null],
  ])('%s -> %s', (text, expected) => {
    expect(lensMillimeters(text)).toBe(expected);
  });
});

describe('buildClipMapping', () => {
  it('copia pasta, data e arquivos ignorados', () => {
    const input = scan([clip('take1.mov')]);
    const result = buildClipMapping([take(1)], input);
    expect(result.folder).toBe(input.folder);
    expect(result.scannedAt).toBe(input.scannedAt);
    expect(result.ignoredFiles).toEqual(input.ignoredFiles);
  });

  it('take sem clipe fica faltando', () => {
    const result = buildClipMapping([take(1), take(2)], scan([clip('take1.mov')]));
    expect(result.takes[0]?.warnings).toEqual([]);
    expect(result.takes[1]).toEqual({
      takeNumber: 2,
      clips: [],
      warnings: [{ code: 'missing', message: 'Nenhum clipe para este take.' }],
    });
  });

  it('clipe de take inexistente vai para orphanClips', () => {
    const result = buildClipMapping([take(1), take(2)], scan([clip('take9.mov')]));
    expect(result.orphanClips.map((c) => c.fileName)).toEqual(['take9.mov']);
    expect(result.takes.every((t) => t.clips.length === 0)).toBe(true);
  });

  it('clipe ilegível órfão recebe só o aviso unreadable', () => {
    const broken = clip('take9.mov', { video: null, readError: 'Arquivo corrompido.' });
    const result = buildClipMapping([take(1)], scan([broken]));
    expect(result.orphanClips[0]?.warnings).toEqual([
      { code: 'unreadable', message: 'Arquivo corrompido.' },
    ]);
  });

  it('clipe curto avisa com a duração arredondada para baixo', () => {
    const short = clip('take1.mov', { video: video({ durationSeconds: 3.96 }) });
    const result = buildClipMapping([take(1)], scan([short]));
    expect(result.takes[0]?.clips[0]?.warnings).toEqual([
      { code: 'too-short', message: 'O clipe tem 3,9s, menos que o mínimo do take (4s).' },
    ]);
  });

  it('duração igual ao mínimo não avisa', () => {
    const exact = clip('take1.mov', { video: video({ durationSeconds: 4 }) });
    const result = buildClipMapping([take(1)], scan([exact]));
    expect(result.takes[0]?.clips[0]?.warnings).toEqual([]);
  });

  it('lente diferente avisa', () => {
    const c = clip('take1.mov', { video: video({ lensType: 'iPhone 14 Pro Max 24mm' }) });
    const result = buildClipMapping([take(1, { lens: '52mm' })], scan([c]));
    expect(result.takes[0]?.clips[0]?.warnings).toEqual([
      { code: 'lens-mismatch', message: 'Lente do clipe (24mm) diferente da do roteiro (52mm).' },
    ]);
  });

  it('lente ausente em um dos lados ou igual não avisa', () => {
    const withLens = video({ lensType: 'iPhone 14 Pro Max 24mm' });
    const result = buildClipMapping(
      [take(1, { lens: null }), take(2, { lens: '52mm' }), take(3, { lens: '24mm' })],
      scan([
        clip('take1.mov', { video: withLens }),
        clip('take2.mov', { video: video({ lensType: null }) }),
        clip('take3.mov', { video: withLens }),
      ]),
    );
    expect(result.takes.flatMap((t) => t.clips.flatMap((c) => c.warnings))).toEqual([]);
  });

  it('take3c sem take3a e take3b avisa as duas', () => {
    const result = buildClipMapping([take(3)], scan([clip('take3c.mov')]));
    expect(result.takes[0]?.warnings).toEqual([
      { code: 'attempt-gap', message: 'Tentativa faltando: take3a, take3b.' },
    ]);
  });

  it('take3 sem letra junto com take3a não avisa', () => {
    const result = buildClipMapping([take(3)], scan([clip('take3.mov'), clip('take3a.mov')]));
    expect(result.takes[0]?.warnings).toEqual([]);
  });

  it('arquivos repetidos avisam, na ordem dos clipes ordenados', () => {
    const result = buildClipMapping([take(3)], scan([clip('take3a.mov'), clip('TAKE3A.mp4')]));
    expect(result.takes[0]?.warnings).toEqual([
      { code: 'duplicate', message: 'Mais de um arquivo para take3a: TAKE3A.mp4, take3a.mov.' },
    ]);
  });

  it('take01 e take1 contam como o mesmo rótulo', () => {
    const result = buildClipMapping([take(1)], scan([clip('take01.mp4'), clip('take1.mov')]));
    expect(result.takes[0]?.warnings).toEqual([
      { code: 'duplicate', message: 'Mais de um arquivo para take1: take01.mp4, take1.mov.' },
    ]);
  });

  it('todos os clipes ilegíveis', () => {
    const a = clip('take1a.mov', { video: null, readError: 'Erro A' });
    const b = clip('take1b.mov', { video: null, readError: 'Erro B' });
    const result = buildClipMapping([take(1)], scan([a, b]));
    expect(result.takes[0]?.warnings).toEqual([
      { code: 'no-readable-clip', message: 'Nenhum clipe legível para este take.' },
    ]);
    expect(result.takes[0]?.clips.map((c) => c.warnings)).toEqual([
      [{ code: 'unreadable', message: 'Erro A' }],
      [{ code: 'unreadable', message: 'Erro B' }],
    ]);
  });

  it('clipe ilegível não recebe too-short nem lens-mismatch', () => {
    const broken = clip('take1.mov', { video: null, readError: 'Erro' });
    const result = buildClipMapping([take(1, { lens: '52mm' })], scan([broken]));
    expect(result.takes[0]?.clips[0]?.warnings.map((w) => w.code)).toEqual(['unreadable']);
  });

  it('resolução baixa vira um aviso geral e ilegível não conta', () => {
    const low = video({ width: 720, height: 1280 });
    const result = buildClipMapping(
      [take(1)],
      scan([
        clip('take1a.mov', { video: low }),
        clip('take1b.mov', { video: low }),
        clip('take1c.mov'),
        clip('take1d.mov', { video: null, readError: 'Erro' }),
      ]),
    );
    expect(result.notices).toEqual([
      '2 clipe(s) com menos de 1080 pixels no lado menor: a exportação vai sair ampliada.',
    ]);
  });

  it('resolução baixa conta também clipes órfãos', () => {
    const low = video({ width: 1920, height: 720 });
    const result = buildClipMapping([take(1)], scan([clip('take9.mov', { video: low })]));
    expect(result.notices).toEqual([
      '1 clipe(s) com menos de 1080 pixels no lado menor: a exportação vai sair ampliada.',
    ]);
  });

  it('pasta sem clipes', () => {
    const result = buildClipMapping([take(1), take(2)], scan([]));
    expect(result.notices).toEqual([NO_CLIPS_NOTICE]);
    expect(result.takes.map((t) => t.warnings.map((w) => w.code))).toEqual([
      ['missing'],
      ['missing'],
    ]);
  });

  it('ordena clipes', () => {
    const result = buildClipMapping(
      [take(1)],
      scan([clip('take1b.mov'), clip('take1.mov'), clip('take1a.mov')]),
    );
    expect(result.takes[0]?.clips.map((c) => c.fileName)).toEqual([
      'take1.mov',
      'take1a.mov',
      'take1b.mov',
    ]);
  });

  it('ordena órfãos por número do take', () => {
    const result = buildClipMapping([], scan([clip('take9.mov'), clip('take5.mov')]));
    expect(result.orphanClips.map((c) => c.fileName)).toEqual(['take5.mov', 'take9.mov']);
  });

  it('sem takes no roteiro', () => {
    const result = buildClipMapping([], scan([clip('take1.mov'), clip('take2.mov')]));
    expect(result.takes).toEqual([]);
    expect(result.orphanClips).toHaveLength(2);
  });
});
