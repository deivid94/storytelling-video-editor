import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('usa os padrões', () => {
    expect(loadConfig({ ANTHROPIC_API_KEY: 'sk-test' })).toMatchObject({
      port: 3333,
      scriptInterpreter: 'claude',
      claudeScriptModel: 'claude-opus-5-5',
    });
    expect(loadConfig({ ANTHROPIC_API_KEY: 'sk-test' }).dataDir).toMatch(/[\\/]data$/);
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
    expect(loadConfig({ ANTHROPIC_API_KEY: 'sk-test', DATA_DIR: '' }).dataDir).toMatch(
      /[\\/]data$/,
    );
  });

  it.each([
    ['SCRIPT_INTERPRETER', 'gpt'],
    ['API_PORT', 'abc'],
    ['API_PORT', '0'],
  ])('falha na inicialização com %s=%s', (key, value) => {
    expect(() => loadConfig({ ANTHROPIC_API_KEY: 'sk-test', [key]: value })).toThrow(key);
  });

  describe('FFPROBE_PATH', () => {
    const base = { ANTHROPIC_API_KEY: 'sk-test' };

    it('usa ffprobe do PATH por padrão', () => {
      expect(loadConfig(base).ffprobePath).toBe('ffprobe');
    });

    it('lê o caminho informado', () => {
      const ffprobePath = String.raw`C:\ffmpeg\bin\ffprobe.exe`;
      expect(loadConfig({ ...base, FFPROBE_PATH: ffprobePath }).ffprobePath).toBe(ffprobePath);
    });

    it('trata valor em branco como padrão', () => {
      expect(loadConfig({ ...base, FFPROBE_PATH: '  ' }).ffprobePath).toBe('ffprobe');
    });
  });

  describe('ANTHROPIC_API_KEY', () => {
    const message =
      'ANTHROPIC_API_KEY não definida. Preencha o .env ou use SCRIPT_INTERPRETER=fake.';

    it('falha com o interpretador claude e sem chave', () => {
      expect(() => loadConfig({})).toThrow(message);
    });

    it('falha com o interpretador claude e chave só com espaços', () => {
      expect(() => loadConfig({ ANTHROPIC_API_KEY: '  ' })).toThrow(message);
    });

    it('aceita o interpretador fake sem chave', () => {
      expect(loadConfig({ SCRIPT_INTERPRETER: 'fake' }).scriptInterpreter).toBe('fake');
    });

    it('aceita o interpretador claude com chave', () => {
      expect(loadConfig({ ANTHROPIC_API_KEY: 'sk-test' }).scriptInterpreter).toBe('claude');
    });
  });
});
