import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClipMapping, MappedClip, ScriptTake } from '../api/projects';
import { ClipMappingView } from './ClipMappingView';

function makeTake(number: number, name: string): ScriptTake {
  return {
    number,
    name,
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
}

function makeClip(patch: Partial<MappedClip> = {}): MappedClip {
  return {
    fileName: 'T01_A1.mov',
    takeNumber: 1,
    attempt: 'A1',
    video: { durationSeconds: 3.96, width: 1920, height: 1080, fps: 30, lensType: null },
    readError: null,
    warnings: [],
    ...patch,
  };
}

function makeMapping(patch: Partial<ClipMapping> = {}): ClipMapping {
  return {
    folder: 'D:\\clipes',
    scannedAt: '2026-01-01T00:00:00Z',
    takes: [{ takeNumber: 1, clips: [makeClip()], warnings: [] }],
    orphanClips: [],
    ignoredFiles: [],
    notices: [],
    ...patch,
  };
}

const takes = [makeTake(1, 'Abertura'), makeTake(2, 'Meio')];

describe('ClipMappingView', () => {
  it('mostra o título do take e os dados do clipe', () => {
    render(<ClipMappingView mapping={makeMapping()} takes={takes} />);

    const group = screen.getByRole('group', { name: 'Clipes do take 1' });
    expect(within(group).getByText('Take 1: Abertura')).toBeDefined();
    expect(within(group).getByText('T01_A1.mov · 3,9s · 1920×1080')).toBeDefined();
  });

  it('usa só "Take n" quando o take não está no roteiro', () => {
    render(<ClipMappingView mapping={makeMapping()} takes={[]} />);

    expect(within(screen.getByRole('group')).getByText('Take 1')).toBeDefined();
  });

  it('take faltando mostra a mensagem e o aviso dentro do grupo', () => {
    const mapping = makeMapping({
      takes: [
        { takeNumber: 2, clips: [], warnings: [{ code: 'missing', message: 'Take 2 sem clipe.' }] },
      ],
    });
    render(<ClipMappingView mapping={mapping} takes={takes} />);

    const group = screen.getByRole('group', { name: 'Clipes do take 2' });
    expect(within(group).getByText('Nenhum clipe para este take.')).toBeDefined();
    expect(within(group).getByText('Take 2 sem clipe.')).toBeDefined();
  });

  it('mostra o aviso de lente no grupo certo', () => {
    const clip = makeClip({ warnings: [{ code: 'lens-mismatch', message: 'Lente diferente.' }] });
    const mapping = makeMapping({
      takes: [
        { takeNumber: 1, clips: [], warnings: [] },
        { takeNumber: 2, clips: [clip], warnings: [] },
      ],
    });
    render(<ClipMappingView mapping={mapping} takes={takes} />);

    const group2 = screen.getByRole('group', { name: 'Clipes do take 2' });
    expect(within(group2).getByText('Lente diferente.')).toBeDefined();
    const group1 = screen.getByRole('group', { name: 'Clipes do take 1' });
    expect(within(group1).queryByText('Lente diferente.')).toBeNull();
  });

  it('clipe ilegível mostra só o nome, sem quebrar', () => {
    const clip = makeClip({
      video: null,
      readError: 'corrompido',
      warnings: [{ code: 'unreadable', message: 'Não foi possível ler.' }],
    });
    render(
      <ClipMappingView
        mapping={makeMapping({ takes: [{ takeNumber: 1, clips: [clip], warnings: [] }] })}
        takes={takes}
      />,
    );

    expect(screen.getByText('T01_A1.mov')).toBeDefined();
    expect(screen.getByText('Não foi possível ler.')).toBeDefined();
  });

  it('seção de órfãos só aparece com órfãos', () => {
    const { rerender } = render(<ClipMappingView mapping={makeMapping()} takes={takes} />);
    expect(screen.queryByText('Clipes sem take no roteiro')).toBeNull();

    const orphan = makeClip({ fileName: 'T09_A1.mov', takeNumber: 9 });
    rerender(<ClipMappingView mapping={makeMapping({ orphanClips: [orphan] })} takes={takes} />);
    expect(screen.getByText('Clipes sem take no roteiro')).toBeDefined();
    expect(screen.getByText('T09_A1.mov · 3,9s · 1920×1080')).toBeDefined();
  });

  it('arquivos ignorados aparecem num details só quando existem', () => {
    const { rerender } = render(<ClipMappingView mapping={makeMapping()} takes={takes} />);
    expect(screen.queryByText(/ignorado/)).toBeNull();

    const ignoredFiles = [
      { fileName: 'a.txt', reason: 'não é vídeo' },
      { fileName: 'b.txt', reason: 'não é vídeo' },
      { fileName: 'c.mov', reason: 'nome fora do padrão' },
    ];
    rerender(<ClipMappingView mapping={makeMapping({ ignoredFiles })} takes={takes} />);
    expect(screen.getByText('3 arquivo(s) ignorado(s)')).toBeDefined();
    expect(screen.getByText('c.mov: nome fora do padrão')).toBeDefined();
  });

  it('mostra os notices com role="note"', () => {
    render(<ClipMappingView mapping={makeMapping({ notices: ['Pasta vazia.'] })} takes={takes} />);

    expect(screen.getByRole('note').textContent).toBe('Pasta vazia.');
  });
});

describe('ClipMappingView chaves dos avisos', () => {
  it('renderiza avisos repetidos com o mesmo código sem erro de chave', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = [
      { code: 'duplicate' as const, message: 'Rótulo A repetido.' },
      { code: 'duplicate' as const, message: 'Rótulo B repetido.' },
    ];
    const clip = makeClip({
      warnings: [
        { code: 'lens-mismatch', message: 'Lente X.' },
        { code: 'lens-mismatch', message: 'Lente Y.' },
      ],
    });
    const mapping = makeMapping({ takes: [{ takeNumber: 1, clips: [clip], warnings }] });
    render(<ClipMappingView mapping={mapping} takes={takes} />);

    expect(screen.getByText('Rótulo A repetido.')).toBeDefined();
    expect(screen.getByText('Rótulo B repetido.')).toBeDefined();
    expect(screen.getByText('Lente X.')).toBeDefined();
    expect(screen.getByText('Lente Y.')).toBeDefined();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
