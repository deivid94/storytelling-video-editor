import { useState } from 'react';
import type { FormEvent } from 'react';

interface ClipsFolderFormProps {
  initialFolder: string;
  isScanning: boolean;
  onSubmit(folder: string): void;
}

export function ClipsFolderForm({ initialFolder, isScanning, onSubmit }: ClipsFolderFormProps) {
  const [folder, setFolder] = useState(initialFolder);
  const canSubmit = folder.trim() !== '' && !isScanning;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit(folder);
  }

  return (
    <form onSubmit={handleSubmit} className="clips-folder-form">
      <label>
        Pasta dos clipes
        <input type="text" value={folder} onChange={(event) => setFolder(event.target.value)} />
      </label>
      <button type="submit" disabled={!canSubmit}>
        {isScanning ? 'Lendo clipes…' : 'Ler clipes'}
      </button>
    </form>
  );
}
