import type { ClipMapping, MappedClip, ScriptTake } from '../api/projects';
import { formatClipDuration, formatResolution } from '../lib/clips';

interface ClipMappingViewProps {
  mapping: ClipMapping;
  takes: ScriptTake[];
}

function clipLabel(clip: MappedClip): string {
  if (clip.video === null) return clip.fileName;
  return `${clip.fileName} · ${formatClipDuration(clip.video.durationSeconds)} · ${formatResolution(clip.video)}`;
}

function ClipItem({ clip }: { clip: MappedClip }) {
  return (
    <li>
      {clipLabel(clip)}
      {clip.warnings.length > 0 && (
        <ul>
          {clip.warnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ClipMappingView({ mapping, takes }: ClipMappingViewProps) {
  function takeTitle(takeNumber: number): string {
    const take = takes.find((item) => item.number === takeNumber);
    return take === undefined ? `Take ${takeNumber}` : `Take ${takeNumber}: ${take.name}`;
  }

  return (
    <section className="clip-mapping">
      <h2>Clipes</h2>
      {mapping.notices.map((notice) => (
        <p key={notice} role="note">
          {notice}
        </p>
      ))}
      {mapping.takes.map((take) => (
        <div key={take.takeNumber} role="group" aria-label={`Clipes do take ${take.takeNumber}`}>
          <h3>{takeTitle(take.takeNumber)}</h3>
          {take.warnings.length > 0 && (
            <ul>
              {take.warnings.map((warning) => (
                <li key={warning.code}>{warning.message}</li>
              ))}
            </ul>
          )}
          {take.clips.length === 0 ? (
            <p>Nenhum clipe para este take.</p>
          ) : (
            <ul>
              {take.clips.map((clip) => (
                <ClipItem key={clip.fileName} clip={clip} />
              ))}
            </ul>
          )}
        </div>
      ))}
      {mapping.orphanClips.length > 0 && (
        <>
          <h3>Clipes sem take no roteiro</h3>
          <ul>
            {mapping.orphanClips.map((clip) => (
              <ClipItem key={clip.fileName} clip={clip} />
            ))}
          </ul>
        </>
      )}
      {mapping.ignoredFiles.length > 0 && (
        <details>
          <summary>{`${mapping.ignoredFiles.length} arquivo(s) ignorado(s)`}</summary>
          <ul>
            {mapping.ignoredFiles.map((file) => (
              <li key={file.fileName}>{`${file.fileName}: ${file.reason}`}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
