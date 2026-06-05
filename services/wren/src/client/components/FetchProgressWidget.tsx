import type { FetchProgress, QuerySlot } from '../lib/smart/client';

function dotClass(slot: QuerySlot): string {
  switch (slot.state.status) {
    case 'pending': return 'fp-dot fp-pending';
    case 'active':  return 'fp-dot fp-active';
    case 'empty':   return 'fp-dot fp-empty';
    case 'error':   return 'fp-dot fp-error';
    case 'done': {
      const c = slot.state.count;
      if (c <= 5) return 'fp-dot fp-done-1';
      if (c <= 20) return 'fp-dot fp-done-2';
      if (c <= 100) return 'fp-dot fp-done-3';
      return 'fp-dot fp-done-4';
    }
  }
}

function RefBar({ label, data }: { label: string; data: { completed: number; total: number } | null }) {
  const active = data !== null;
  const pct = active && data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
  const isDone = active && data.completed === data.total && data.total > 0;

  return (
    <div className="fp-ref-bar">
      <span className="fp-ref-bar-label">{label}</span>
      <div className="fp-ref-bar-track">
        <div className="fp-ref-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`fp-ref-bar-count${!active ? ' fp-inactive' : ''}`}>
        {isDone ? data.total : active ? `${data.completed}/${data.total}` : '-'}
      </span>
    </div>
  );
}

export default function FetchProgressWidget({ progress }: { progress: FetchProgress }) {
  const { phase, queries, totalResources, settledCount, references, attachments } = progress;

  // Completion check
  const allQueriesSettled = settledCount === queries.length;
  const refsComplete = !references || references.completed === references.total;
  const attachComplete = !attachments || attachments.completed === attachments.total;
  const isComplete = allQueriesSettled && refsComplete && attachComplete && phase === 'attachments';

  // Group dots by group number (preserving encounter order within groups)
  const groups: QuerySlot[][] = [];
  const groupMap = new Map<number, QuerySlot[]>();
  for (const q of queries) {
    if (!groupMap.has(q.group)) {
      const arr: QuerySlot[] = [];
      groupMap.set(q.group, arr);
      groups.push(arr);
    }
    groupMap.get(q.group)!.push(q);
  }

  // Active labels sorted by longest-loading first (most stable ordering)
  const activeQueries = queries
    .filter(q => q.state.status === 'active')
    .sort((a, b) => (a.activeSince || 0) - (b.activeSince || 0));
  const maxLabels = 5;
  const activeLabels = activeQueries.slice(0, maxLabels).map(q => q.label);
  const hasMore = activeQueries.length > maxLabels;

  // Summary counts
  const doneCount = queries.filter(q => q.state.status === 'done').length;
  const emptyCount = queries.filter(q => q.state.status === 'empty').length;
  const errorCount = queries.filter(q => q.state.status === 'error').length;

  return (
    <div className="fp-widget">
      {/* Zone 1: Counter hero */}
      <div className="fp-counter-hero">
        <div className={`fp-counter-num${isComplete ? ' fp-complete' : ''}`}>
          {totalResources.toLocaleString()}

        </div>
        <div className="fp-counter-label">resources found</div>
      </div>

      {/* Zone 2: Dot strip */}
      <div className="fp-dot-strip">
        {groups.map((group, gi) => (
          <div className="fp-dot-group" key={gi}>
            {group.map((slot, si) => (
              <div key={si} className={dotClass(slot)} title={`${slot.label}: ${slot.state.status}`} />
            ))}
          </div>
        ))}
      </div>

      {/* Zone 3: Status */}
      <div className="fp-status-zone">
        {isComplete ? (
          <div className="fp-status-summary">
            {doneCount} types found · {emptyCount} empty{errorCount > 0 ? ` · ${errorCount} failed` : ''}
          </div>
        ) : phase === 'resources' ? (
          <>
            {activeLabels.length > 0 && (
              <div className="fp-status-active">
                {activeLabels.join(', ')}{hasMore ? ', …' : ''}
              </div>
            )}
            <div className="fp-status-settled">{settledCount} of {queries.length} settled</div>
          </>
        ) : phase === 'references' ? (
          <div className="fp-status-active">Processing references…</div>
        ) : (
          <div className="fp-status-active">Extracting attachments…</div>
        )}

        {/* Pre-allocated ref/attachment bars - always visible */}
        <div className="fp-ref-bars">
          <RefBar label="References" data={references} />
          <RefBar label="Attachments" data={attachments} />
        </div>
      </div>
    </div>
  );
}
