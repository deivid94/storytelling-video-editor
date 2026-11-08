import type { ScriptTake } from '../api/projects';

export function createEmptyTake(number: number): ScriptTake {
  return {
    number,
    name: '',
    minSeconds: 1,
    maxSeconds: 2,
    action: '',
    framing: null,
    lens: null,
    distance: null,
    angle: null,
    hasExecution: false,
    notes: [],
  };
}

/** Numera os takes de 1 em diante, na ordem em que estão. */
export function renumberTakes(takes: ScriptTake[]): ScriptTake[] {
  return takes.map((take, index) => ({ ...take, number: index + 1 }));
}
