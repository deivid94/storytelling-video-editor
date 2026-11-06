import './App.css';
import { InterpretationAlert } from './components/InterpretationAlert';
import { ScriptForm } from './components/ScriptForm';
import { TakesTable } from './components/TakesTable';
import { useProjectEditor } from './hooks/use-project-editor';

export function App() {
  const editor = useProjectEditor();
  const { project } = editor;

  return (
    <main>
      <h1>Storytelling Video Editor</h1>
      {project === null ? (
        <ScriptForm onSubmit={editor.submitScript} isLoading={editor.status === 'loading'} />
      ) : (
        <>
          {project.interpretationError !== null && (
            <InterpretationAlert message={project.interpretationError} />
          )}
          <TakesTable
            takes={editor.takes}
            takeErrors={project.takeErrors}
            isSaving={editor.status === 'saving'}
            isDirty={editor.isDirty}
            onChange={editor.updateTake}
            onAdd={editor.addTake}
            onRemove={editor.removeTake}
            onSave={editor.saveTakes}
          />
          {editor.error !== null && (
            <p role="alert" className="alert">
              {editor.error}
            </p>
          )}
          {editor.savedMessage !== null && <p role="status">{editor.savedMessage}</p>}
        </>
      )}
    </main>
  );
}
