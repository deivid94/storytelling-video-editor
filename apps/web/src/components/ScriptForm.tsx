import { useState } from 'react';
import type { FormEvent } from 'react';

const MAX_SCRIPT_LENGTH = 20000;
const counterFormat = new Intl.NumberFormat('pt-BR');

interface ScriptFormProps {
  onSubmit(scriptText: string): void;
  isLoading: boolean;
}

export function ScriptForm({ onSubmit, isLoading }: ScriptFormProps) {
  const [text, setText] = useState('');
  const canSubmit = text.trim() !== '' && !isLoading;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canSubmit) onSubmit(text);
  }

  return (
    <form onSubmit={handleSubmit} className="script-form">
      <label>
        Roteiro
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={12}
          maxLength={MAX_SCRIPT_LENGTH}
        />
      </label>
      <p>
        {counterFormat.format(text.length)} / {counterFormat.format(MAX_SCRIPT_LENGTH)}
      </p>
      <button type="submit" disabled={!canSubmit}>
        {isLoading ? 'Interpretando…' : 'Interpretar roteiro'}
      </button>
    </form>
  );
}
