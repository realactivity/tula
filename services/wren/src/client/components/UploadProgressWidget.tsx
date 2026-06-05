export interface ProviderUploadState {
  providerName: string;
  /** Pre-estimated chunk count from data size */
  estimatedChunks: number;
  /** Refined once upload finishes (actual count) */
  actualChunks: number | null;
  /** Chunks confirmed uploaded */
  chunksUploaded: number;
  /** Chunks skipped (resume) */
  chunksSkipped: number;
  /** Bytes of input processed so far */
  bytesIn: number;
  /** Total input bytes */
  totalBytesIn: number;
  /** Compressed+encrypted bytes out for this provider */
  bytesOut: number;
  /** Phase for this provider */
  status: 'pending' | 'active' | 'done';
  /** Current chunk being processed (1-based) */
  currentChunk: number;
  /** Sub-phase of current chunk */
  chunkPhase: 'processing' | 'uploading' | 'done';
}

export interface UploadProgress {
  providers: ProviderUploadState[];
  /** Index of the provider currently being uploaded */
  activeProviderIndex: number;
  /** Overall phase */
  phase: 'uploading' | 'finalizing' | 'done';
}

function ProviderRow({ state }: { state: ProviderUploadState }) {
  const pct = state.totalBytesIn > 0
    ? Math.round((state.bytesIn / state.totalBytesIn) * 100)
    : state.status === 'done' ? 100 : 0;

  return (
    <div className={`up-provider${state.status === 'pending' ? ' up-provider-pending' : ''}`}>
      <div className="fp-ref-bar">
        <span className="fp-ref-bar-label">
          {state.providerName}
          {state.status === 'done' && ' ✓'}
        </span>
        <div className="fp-ref-bar-track">
          <div className="fp-ref-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="fp-ref-bar-count">{pct}%</span>
      </div>
    </div>
  );
}

export default function UploadProgressWidget({ progress }: { progress: UploadProgress }) {
  const { providers, phase } = progress;
  const isDone = phase === 'done';
  const isFinalizing = phase === 'finalizing';

  // Active provider status text while work is still in progress.
  const active = providers.find(p => p.status === 'active');
  const statusText = isDone
    ? null
    : isFinalizing
    ? 'Finalizing session…'
    : active
    ? active.chunkPhase === 'processing'
      ? 'Compressing & encrypting…'
      : `Uploading chunk ${active.currentChunk}`
    : 'Preparing upload…';

  return (
    <div className="up-widget">
      {/* One row per provider */}
      <div className="up-providers">
        {providers.map((p, i) => <ProviderRow key={i} state={p} />)}
      </div>

      {statusText && <div className="up-status">{statusText}</div>}
    </div>
  );
}
