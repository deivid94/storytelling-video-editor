import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app.js';
import { createClaudeScriptInterpreter } from './clients/claude-script-interpreter.js';
import { createFakeScriptInterpreter } from './clients/fake-script-interpreter.js';
import { createFfprobeVideoProber } from './clients/ffprobe-video-prober.js';
import { loadConfig } from './config.js';
import { createClipFolderRepository } from './repositories/clip-folder.repository.js';
import { createFileProjectRepository } from './repositories/project.repository.js';
import { createProjectService } from './services/project.service.js';

const LOCAL_HOST = '127.0.0.1';
const config = loadConfig();

// O cliente da Anthropic só é criado com o interpretador real: ele exige a chave de API.
const scriptInterpreter =
  config.scriptInterpreter === 'claude'
    ? createClaudeScriptInterpreter({ client: new Anthropic(), model: config.claudeScriptModel })
    : createFakeScriptInterpreter();

const projectService = createProjectService({
  projectRepository: createFileProjectRepository(config.dataDir),
  scriptInterpreter,
  clipFolderRepository: createClipFolderRepository(),
  videoProber: createFfprobeVideoProber({ ffprobePath: config.ffprobePath }),
  now: () => new Date(),
  createId: () => randomUUID(),
});

// Só 127.0.0.1: a API lê pastas do computador e não pode ficar aberta para a rede.
createApp({ projectService }).listen(config.port, LOCAL_HOST, () => {
  console.log(`API rodando em http://${LOCAL_HOST}:${config.port}`);
});
