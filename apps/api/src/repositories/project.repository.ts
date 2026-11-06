import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/app-error.js';
import type { Project } from '../types/project.js';

export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export function createFileProjectRepository(dataDir: string): ProjectRepository {
  const projectDir = (id: string) => path.join(dataDir, 'projects', id);
  const projectFile = (id: string) => path.join(projectDir(id), 'project.json');

  async function save(project: Project): Promise<void> {
    const file = projectFile(project.id);
    const tempFile = `${file}.tmp`;
    await fs.mkdir(projectDir(project.id), { recursive: true });
    await fs.writeFile(tempFile, JSON.stringify(project, null, 2));
    await fs.rename(tempFile, file);
  }

  async function findById(id: string): Promise<Project | null> {
    if (!isValidId(id)) return null;
    let content: string;
    try {
      content = await fs.readFile(projectFile(id), 'utf8');
    } catch (error) {
      if (isFileNotFound(error)) return null;
      throw error;
    }
    try {
      return JSON.parse(content) as Project;
    } catch {
      throw new AppError(500, 'O arquivo do projeto está corrompido.');
    }
  }

  return { save, findById };
}
