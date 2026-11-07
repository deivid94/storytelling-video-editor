import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Framing, ScriptTake, TakeError } from '../api/projects';
import { parseSecondsInput } from '../lib/duration';

type TakePatch = Partial<Omit<ScriptTake, 'number'>>;

interface TakesTableProps {
  takes: ScriptTake[];
  takeErrors: TakeError[];
  isSaving: boolean;
  isDirty: boolean;
  onChange(index: number, patch: TakePatch): void;
  onAdd(): void;
  onRemove(index: number): void;
  onSave(): void;
}

const FRAMING_OPTIONS: { value: Framing | ''; label: string }[] = [
  { value: '', label: '—' },
  { value: 'close', label: 'Close' },
  { value: 'medium', label: 'Médio' },
  { value: 'wide', label: 'Aberto' },
];

function secondsToText(seconds: number): string {
  return String(seconds).replace('.', ',');
}

function textToSeconds(text: string): number {
  return parseSecondsInput(text) ?? 0;
}

function notesToText(notes: string[]): string {
  return notes.join('\n');
}

function textToNotes(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

interface FieldProps {
  label: string;
  error: string | undefined;
  errorId: string;
  children: (describedBy: string | undefined) => ReactNode;
}

/** Rótulo + campo + mensagem de erro embaixo do campo. */
function Field({ label, error, errorId, children }: FieldProps) {
  return (
    <div className="field">
      <label>
        {label}
        {children(error === undefined ? undefined : errorId)}
      </label>
      {error !== undefined && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

interface LocalTextProps<T> {
  value: T;
  toText(value: T): string;
  fromText(text: string): T;
  onValueChange(value: T): void;
  render(props: { text: string; onTextChange(text: string): void }): ReactNode;
}

/**
 * Guarda o texto digitado, para que "2," não vire "2" no meio da digitação.
 * Só recopia do valor quando ele muda por fora (ex.: renumeração depois de salvar).
 */
function LocalText<T>({ value, toText, fromText, onValueChange, render }: LocalTextProps<T>) {
  const [text, setText] = useState(toText(value));
  const [previousValue, setPreviousValue] = useState(value);

  if (JSON.stringify(previousValue) !== JSON.stringify(value)) {
    setPreviousValue(value);
    if (JSON.stringify(fromText(text)) !== JSON.stringify(value)) setText(toText(value));
  }

  return render({
    text,
    onTextChange(newText) {
      setText(newText);
      onValueChange(fromText(newText));
    },
  });
}

export function TakesTable({
  takes,
  takeErrors,
  isSaving,
  isDirty,
  onChange,
  onAdd,
  onRemove,
  onSave,
}: TakesTableProps) {
  return (
    <section>
      {takes.map((take, index) => {
        const errorFor = (field: keyof ScriptTake) =>
          takeErrors.find((error) => error.takeNumber === take.number && error.field === field)
            ?.message;
        const errorId = (field: string) => `take-${take.number}-${field}-error`;

        // key por índice é seguro: LocalText recopia o texto quando o valor muda por fora.
        return (
          <fieldset key={index} aria-label={`Take ${take.number}`} disabled={isSaving}>
            <legend>Take {take.number}</legend>

            <Field label="Nome" error={errorFor('name')} errorId={errorId('name')}>
              {(describedBy) => (
                <input
                  type="text"
                  value={take.name}
                  aria-describedby={describedBy}
                  onChange={(event) => onChange(index, { name: event.target.value })}
                />
              )}
            </Field>

            {(['minSeconds', 'maxSeconds'] as const).map((field) => (
              <Field
                key={field}
                label={field === 'minSeconds' ? 'Duração mínima (s)' : 'Duração máxima (s)'}
                error={errorFor(field)}
                errorId={errorId(field)}
              >
                {(describedBy) => (
                  <LocalText
                    value={take[field]}
                    toText={secondsToText}
                    fromText={textToSeconds}
                    onValueChange={(seconds) => onChange(index, { [field]: seconds })}
                    render={({ text, onTextChange }) => (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={text}
                        aria-describedby={describedBy}
                        onChange={(event) => onTextChange(event.target.value)}
                      />
                    )}
                  />
                )}
              </Field>
            ))}

            <Field label="Ação" error={errorFor('action')} errorId={errorId('action')}>
              {(describedBy) => (
                <input
                  type="text"
                  value={take.action}
                  aria-describedby={describedBy}
                  onChange={(event) => onChange(index, { action: event.target.value })}
                />
              )}
            </Field>

            <Field label="Enquadramento" error={errorFor('framing')} errorId={errorId('framing')}>
              {(describedBy) => (
                <select
                  value={take.framing ?? ''}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    onChange(index, {
                      framing: event.target.value === '' ? null : (event.target.value as Framing),
                    })
                  }
                >
                  {FRAMING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            {(
              [
                ['lens', 'Lente'],
                ['distance', 'Distância'],
                ['angle', 'Ângulo'],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} label={label} error={errorFor(field)} errorId={errorId(field)}>
                {(describedBy) => (
                  <input
                    type="text"
                    value={take[field] ?? ''}
                    aria-describedby={describedBy}
                    onChange={(event) =>
                      onChange(index, {
                        [field]: event.target.value === '' ? null : event.target.value,
                      })
                    }
                  />
                )}
              </Field>
            ))}

            <Field
              label="Tem execução"
              error={errorFor('hasExecution')}
              errorId={errorId('hasExecution')}
            >
              {(describedBy) => (
                <input
                  type="checkbox"
                  checked={take.hasExecution}
                  aria-describedby={describedBy}
                  onChange={(event) => onChange(index, { hasExecution: event.target.checked })}
                />
              )}
            </Field>

            <Field label="Notas" error={errorFor('notes')} errorId={errorId('notes')}>
              {(describedBy) => (
                <LocalText
                  value={take.notes}
                  toText={notesToText}
                  fromText={textToNotes}
                  onValueChange={(notes) => onChange(index, { notes })}
                  render={({ text, onTextChange }) => (
                    <textarea
                      rows={3}
                      value={text}
                      aria-describedby={describedBy}
                      onChange={(event) => onTextChange(event.target.value)}
                    />
                  )}
                />
              )}
            </Field>

            <button type="button" onClick={() => onRemove(index)}>
              Remover take {take.number}
            </button>
          </fieldset>
        );
      })}

      <button type="button" onClick={onAdd} disabled={isSaving}>
        Adicionar take
      </button>
      <button type="button" onClick={onSave} disabled={!isDirty || isSaving}>
        Salvar takes
      </button>
    </section>
  );
}
