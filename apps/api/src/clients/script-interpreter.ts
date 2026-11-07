import type { InterpretedTake } from '../types/project.js';

export interface ScriptInterpreter {
  interpret(scriptText: string): Promise<InterpretedTake[]>;
}

export class ScriptInterpretationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ScriptInterpretationError';
  }
}
