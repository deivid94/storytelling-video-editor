import path from 'node:path';
import {
  ScriptInterpretationError,
  type ScriptInterpreter,
} from '../clients/script-interpreter.js';
import { VideoProbeError, type VideoProber } from '../clients/video-prober.js';
import { AppError } from '../errors/app-error.js';
import type { ClipFolderRepository } from '../repositories/clip-folder.repository.js';
import type { ProjectRepository } from '../repositories/project.repository.js';
import type { ClipScan, IgnoredFile, ScannedClip } from '../types/clip.js';
import type { InterpretedTake, Project, ProjectView } from '../types/project.js';
import { parseClipFileName } from './clip-names.js';
import { buildClipMapping, normalizeFolderInput } from './clip-rules.js';
import { findTakeErrors, normalizeTakes, validateScriptText } from './take-rules.js';

export const NO_TAKES_MESSAGE = 'Nenhum take encontrado no roteiro. Preencha os takes à mão.';
export const INTERPRETATION_FAILED_MESSAGE =
  'Não foi possível interpretar o roteiro. Preencha os takes à mão.';

export interface ProjectServiceDeps {
  projectRepository: ProjectRepository;
  scriptInterpreter: ScriptInterpreter;
  clipFolderRepository: ClipFolderRepository;
  videoProber: VideoProber;
  now: () => Date;
  createId: () => string;
}

export interface ProjectService {
  createFromScript(scriptText: string): Promise<ProjectView>;
  getById(id: string): Promise<ProjectView>;
  updateTakes(id: string, takes: InterpretedTake[]): Promise<ProjectView>;
  scanClips(id: string, folderInput: string): Promise<ProjectView>;
}

function toView(project: Project): ProjectView {
  return {
    ...project,
    takeErrors: findTakeErrors(project.takes),
    clipMapping: project.clipScan ? buildClipMapping(project.takes, project.clipScan) : null,
  };
}

export function createProjectService(deps: ProjectServiceDeps): ProjectService {
  const { projectRepository, scriptInterpreter, clipFolderRepository, videoProber, now, createId } =
    deps;

  async function findOrThrow(id: string): Promise<Project> {
    const project = await projectRepository.findById(id);
    if (!project) {
      throw new AppError(404, 'Projeto não encontrado.');
    }
    return project;
  }

  // Só a falha de interpretação vira aviso; qualquer outro erro é bug e sobe.
  async function interpretScript(
    scriptText: string,
  ): Promise<{ takes: InterpretedTake[]; interpretationError: string | null }> {
    try {
      const takes = await scriptInterpreter.interpret(scriptText);
      return { takes, interpretationError: takes.length === 0 ? NO_TAKES_MESSAGE : null };
    } catch (error) {
      if (!(error instanceof ScriptInterpretationError)) throw error;
      console.error('Falha ao interpretar o roteiro:', error);
      return { takes: [], interpretationError: INTERPRETATION_FAILED_MESSAGE };
    }
  }

  async function createFromScript(scriptText: string): Promise<ProjectView> {
    const validText = validateScriptText(scriptText);
    const { takes, interpretationError } = await interpretScript(validText);
    const project: Project = {
      id: createId(),
      createdAt: now().toISOString(),
      scriptText: validText,
      takes: normalizeTakes(takes),
      interpretationError,
      clipScan: null,
    };
    await projectRepository.save(project);
    return toView(project);
  }

  async function getById(id: string): Promise<ProjectView> {
    return toView(await findOrThrow(id));
  }

  async function updateTakes(id: string, takes: InterpretedTake[]): Promise<ProjectView> {
    const project = await findOrThrow(id);
    const updated: Project = {
      ...project,
      takes: normalizeTakes(takes),
      interpretationError: null,
    };
    await projectRepository.save(updated);
    return toView(updated);
  }

  // Lê um arquivo take. Arquivo ilegível vira aviso; qualquer outro erro (ex.: sem ffprobe) sobe.
  async function scanFile(
    folder: string,
    fileName: string,
    parsed: { takeNumber: number; attempt: string | null },
  ): Promise<ScannedClip> {
    const { takeNumber, attempt } = parsed;
    try {
      const video = await videoProber.probe(path.join(folder, fileName));
      return { fileName, takeNumber, attempt, video, readError: null };
    } catch (error) {
      if (!(error instanceof VideoProbeError)) throw error;
      return { fileName, takeNumber, attempt, video: null, readError: error.message };
    }
  }

  async function scanClips(id: string, folderInput: string): Promise<ProjectView> {
    const project = await findOrThrow(id);
    const folder = normalizeFolderInput(folderInput);
    const fileNames = await clipFolderRepository.listFileNames(folder);
    const clips: ScannedClip[] = [];
    const ignoredFiles: IgnoredFile[] = [];
    // Um arquivo por vez: o ffprobe em vários vídeos ao mesmo tempo pesa no computador.
    for (const fileName of fileNames) {
      const parsed = parseClipFileName(fileName);
      if (parsed.ok) {
        clips.push(await scanFile(folder, fileName, parsed));
      } else {
        ignoredFiles.push({ fileName, reason: parsed.reason });
      }
    }
    const clipScan: ClipScan = { folder, scannedAt: now().toISOString(), clips, ignoredFiles };
    const updated: Project = { ...project, clipScan };
    await projectRepository.save(updated);
    return toView(updated);
  }

  return { createFromScript, getById, updateTakes, scanClips };
}
