import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('usa os padrões', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3333,
      scriptInterpreter: 'claude',
      claudeScriptModel: 'claude-opus-5-5',
    });
    expect(loadConfig({}).dataDir).toMatch(/[\\/]data$/);
  });

  it('lê as variáveis', () => {
    expect(
      loadConfig({
        API_PORT: '4000',
        SCRIPT_INTERPRETER: 'fake',
        CLAUDE_SCRIPT_MODEL: 'm',
        DATA_DIR: 'x',
      }),
    ).toMatchObject({
      port: 4000,
      scriptInterpreter: 'fake',
      claudeScriptModel: 'm',
      dataDir: path.resolve('x'),
    });
  });

  it('trata DATA_DIR vazio como padrão', () => {
    expect(loadConfig({ DATA_DIR: '' }).dataDir).toMatch(/[\\/]data$/);
  });

  it.each([
    ['SCRIPT_INTERPRETER', 'gpt'],
    ['API_PORT', 'abc'],
    ['API_PORT', '0'],
  ])('falha na inicialização com %s=%s', (key, value) => {
    expect(() => loadConfig({ [key]: value })).toThrow(key);
  });
});
