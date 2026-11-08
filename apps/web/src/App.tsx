import './App.css';
import { ClipMappingView } from './components/ClipMappingView';
import { ClipsFolderForm } from './components/ClipsFolderForm';
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
            // Os erros vêm do último salvamento; com edição local os números dos takes podem ter mudado.
            takeErrors={editor.isDirty ? [] : project.takeErrors}
            isSaving={editor.status === 'saving'}
            isDirty={editor.isDirty}
            onChange={editor.updateTake}
            onAdd={editor.addTake}
            onRemove={editor.removeTake}
            onSave={editor.saveTakes}
          />
          {editor.savedMessage !== null && <p role="status">{editor.savedMessage}</p>}
          <ClipsFolderForm
            initialFolder={project.clipMapping?.folder ?? ''}
            isScanning={editor.status === 'scanning'}
            onSubmit={editor.scanClips}
          />
          {project.clipMapping !== null && (
            <>
              {editor.isDirty && (
                <p role="note">Salve os takes para atualizar os avisos dos clipes.</p>
              )}
              <ClipMappingView mapping={project.clipMapping} takes={project.takes} />
            </>
          )}
        </>
      )}
      {editor.error !== null && (
        <p role="alert" className="alert">
          {editor.error}
        </p>
      )}
    </main>
  );
}
