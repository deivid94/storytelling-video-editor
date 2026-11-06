import path from 'node:path';

export interface AppConfig {
  port: number;
  dataDir: string;
  scriptInterpreter: 'claude' | 'fake';
  claudeScriptModel: string;
}

const DEFAULT_PORT = 3333;
const DEFAULT_MODEL = 'claude-opus-5-5';
// Funciona em src/ e em dist/: os dois ficam três pastas abaixo da raiz do repo.
const DEFAULT_DATA_DIR = path.resolve(import.meta.dirname, '../../../data');

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`API_PORT inválida: "${value}". Use um número inteiro entre 1 e 65535.`);
  }
  return port;
}

function parseScriptInterpreter(value: string | undefined): AppConfig['scriptInterpreter'] {
  if (value === undefined || value === '') return 'claude';
  if (value !== 'claude' && value !== 'fake') {
    throw new Error(`SCRIPT_INTERPRETER inválido: "${value}". Use "claude" ou "fake".`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parsePort(env.API_PORT),
    dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : DEFAULT_DATA_DIR,
    scriptInterpreter: parseScriptInterpreter(env.SCRIPT_INTERPRETER),
    claudeScriptModel: env.CLAUDE_SCRIPT_MODEL || DEFAULT_MODEL,
  };
}
