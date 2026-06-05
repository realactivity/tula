import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecordsStore } from '../store/records';
import StatusMessage from '../components/StatusMessage';
import FetchProgressWidget from '../components/FetchProgressWidget';
import UploadProgressWidget from '../components/UploadProgressWidget';
import RecordsHeaderBar from '../components/RecordsHeaderBar';
import {
  countEnabledTerms,
  getAppliedProfile,
  loadRedactionState,
  saveRedactionState,
  type RedactionState,
} from '../lib/redaction';

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  return (
    <span ref={ref} className={`info-tip${open ? ' info-tip-open' : ''}`} onClick={() => setOpen(o => !o)}>
      ?
      {open && <span className="info-tip-bubble">{text}</span>}
    </span>
  );
}

function timeAgo(d: string | null): string {
  if (!d) return 'never';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtSize(b: number | null): string {
  if (!b) return 'no data';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

export default function RecordsPage() {
  const nav = useNavigate();
  const session = useRecordsStore((s) => s.session);
  const status = useRecordsStore((s) => s.status);
  const statusMessage = useRecordsStore((s) => s.statusMessage);
  const error = useRecordsStore((s) => s.error);
  const connections = useRecordsStore((s) => s.connections);
  const connectionState = useRecordsStore((s) => s.connectionState);
  const selected = useRecordsStore((s) => s.selected);
  const loaded = useRecordsStore((s) => s.loaded);
  const loadConnections = useRecordsStore((s) => s.loadConnections);
  const selectAll = useRecordsStore((s) => s.selectAll);
  const selectNone = useRecordsStore((s) => s.selectNone);
  const toggleSelected = useRecordsStore((s) => s.toggleSelected);
  const refreshConnection = useRecordsStore((s) => s.refreshConnection);
  const reconnectConnection = useRecordsStore((s) => s.reconnectConnection);
  const removeConnection = useRecordsStore((s) => s.removeConnection);
  const clearError = useRecordsStore((s) => s.clearError);
  const sendToAI = useRecordsStore((s) => s.sendToAI);
  const downloadJson = useRecordsStore((s) => s.downloadJson);
  const uploadProgress = useRecordsStore((s) => s.uploadProgress);
  const downloadSkillZip = useRecordsStore((s) => s.downloadSkillZip);
  const [redactionState, setRedactionState] = useState<RedactionState>(() => loadRedactionState());

  const dismissConnectionDone = useRecordsStore((s) => s.dismissConnectionDone);

  const isSession = Boolean(session);
  const isFinalized = session?.sessionStatus === 'finalized';
  const busy = status === 'sending' || status === 'finalizing';
  const selCount = selected.size;
  const total = connections.length;
  const allSel = total > 0 && selCount === total;
  const noneSel = selCount === 0;
  const appliedRedactionProfile = getAppliedProfile(redactionState);
  const enabledTermCount = countEnabledTerms(appliedRedactionProfile);
  const applicableRedactionProfiles = redactionState.profiles.filter((profile) => profile.terms.length > 0);
  const appliedProfileSelectValue = appliedRedactionProfile?.id || '';

  useEffect(() => { if (!loaded) loadConnections(); }, []);

  const handleAdd = useCallback(() => {
    nav(session ? `/records/add?session=${session.sessionId}` : '/records/add');
  }, [nav, session]);

  const handleRemove = useCallback(async (id: string) => {
    if (!confirm('Remove this connection? You\u2019ll need to re-authorize.')) return;
    await removeConnection(id);
  }, [removeConnection]);

  const commitRedactionState = useCallback((next: RedactionState) => {
    saveRedactionState(next);
    setRedactionState(loadRedactionState());
  }, []);

  if (!loaded) {
    return (
      <div className="page-top">
        <div className="panel">
          <StatusMessage status="loading" message="Loading…" />
        </div>
      </div>
    );
  }

  if (isSession && isFinalized) {
    return (
      <div className="page-top">
        <div className="panel panel-wide">
          <div className="page-title">Share records with AI</div>
          <div className="page-subtitle">
            End-to-end encrypted - only the requesting AI can decrypt.
          </div>

          <div className="session-done-callout" role="status" aria-live="polite">
            <div className="session-done-title">All set. Records already sent to AI.</div>
            <div className="session-done-sub">You can close this page.</div>
          </div>

          <div className="actions-row">
            <a href="/" className="btn btn-secondary">About Wren</a>
            <a href="/records" className="btn btn-secondary">My Health Records</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`page-top${!isSession ? ' with-records-nav' : ''}`}>
      {!isSession && <RecordsHeaderBar current="records" />}
      <div className="panel panel-wide">
        <div className="page-title">
          {isSession ? 'Share records with AI' : 'My Health Records'}
        </div>
        {isSession && (
          <div className="page-subtitle">
            End-to-end encrypted - only the requesting AI can decrypt.
          </div>
        )}
        {!isSession && total > 0 && (
          <div className="page-subtitle">
            {total} connection{total !== 1 ? 's' : ''} · {selCount} selected
          </div>
        )}

        {/* Global error bar (top of page) */}
        {status === 'error' && error && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            {error}
            <button className="link" onClick={clearError} style={{ marginLeft: 8 }}>Dismiss</button>
          </div>
        )}


        {/* Toolbar */}
        {total > 1 && (
          <div className="toolbar">
            <button className="link" disabled={busy || allSel} onClick={selectAll}>Select all</button>
            <span className="sep">·</span>
            <button className="link" disabled={busy || noneSel} onClick={selectNone}>None</button>
          </div>
        )}

        <div className="records-top-actions">
          <button className={`btn ${total === 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={handleAdd} disabled={busy}>
            Connect to new provider
          </button>
        </div>

        {/* List */}
        {total > 0 && (
          <div className="conn-list">
            {connections.map((c) => {
              const cs = connectionState[c.id];
              const refreshing = cs?.refreshing ?? false;
              const err = cs?.error ?? null;
              const done = cs?.doneMessage ?? null;
              const checked = selected.has(c.id);
              const prog = cs?.refreshProgress;
              const isFailed = c.status === 'expired' || c.status === 'error';
              const canRefresh = c.canRefresh !== false && Boolean(c.refreshToken?.trim());
              const showReconnect = isFailed || !canRefresh;

              return (
                <label key={c.id} className={`conn-card${checked ? ' selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => toggleSelected(c.id)}
                  />
                  <div className="conn-body">
                    <div className="conn-name">
                      <span className={`status-dot status-dot-${c.status}`} />
                      {c.patientDisplayName || c.patientId}
                      {c.patientBirthDate && (
                        <span className="conn-dob">DOB {c.patientBirthDate}</span>
                      )}
                    </div>
                    <div className="conn-meta">
                      {c.providerName} · {fmtSize(c.dataSizeBytes)} · {timeAgo(c.lastFetchedAt)}
                      {!canRefresh ? ' · reconnect required for refresh' : ''}
                    </div>
                    {(refreshing || done) && prog && (
                      <FetchProgressWidget progress={prog} />
                    )}
                    {(c.lastError || err) && (
                      <div className="conn-error">{err || c.lastError}</div>
                    )}
                    <div className="conn-actions">
                      {showReconnect ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={refreshing || busy}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); reconnectConnection(c.id); }}
                        >
                          Reconnect
                        </button>
                      ) : (
                        <button
                          className={`btn btn-sm${done ? ' btn-success' : ' btn-secondary'}`}
                          disabled={refreshing || busy}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); done ? dismissConnectionDone(c.id) : refreshConnection(c.id); }}
                        >
                          {refreshing ? 'Refreshing…' : done ? '✓ Updated' : 'Refresh'}
                        </button>
                      )}
                      {!isSession && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            nav(`/records/browser?source=${encodeURIComponent(c.id)}`);
                          }}
                        >
                          Browse
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={refreshing || busy}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); handleRemove(c.id); }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {total === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            No connections yet.
          </p>
        )}

        {/* Action status bar (near the buttons that trigger it) */}
        {uploadProgress && (status === 'sending' || status === 'done') && (
          <UploadProgressWidget progress={uploadProgress} />
        )}
        {statusMessage && !uploadProgress && status !== 'error' && status !== 'idle' && (
          <StatusMessage
            status={status === 'done' ? 'success' : 'loading'}
            message={statusMessage}
          />
        )}

        {total > 0 && (
          <div className="redaction-card">
            <div className="redaction-head">
              <div>
                <div className="section-title" style={{ marginBottom: 2 }}>Redaction</div>
                <div className="redaction-note">Original records are never modified.</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => nav('/records/redaction')}>
                Manage
              </button>
            </div>
            <div className="redaction-row">
              <label className="redaction-label" htmlFor="redaction-profile-select">Apply</label>
              <select
                id="redaction-profile-select"
                className="redaction-select"
                value={appliedProfileSelectValue}
                onChange={(e) => {
                  commitRedactionState({
                    ...redactionState,
                    settings: {
                      ...redactionState.settings,
                      appliedProfileId: e.target.value || null,
                    },
                  });
                }}
              >
                <option value="">No redaction</option>
                {applicableRedactionProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="redaction-note">
              {appliedRedactionProfile
                ? `Applying "${appliedRedactionProfile.name}" · Active terms: ${enabledTermCount} · Strip attachment base64: ${appliedRedactionProfile.stripAttachmentBase64 ? 'On' : 'Off'}`
                : 'No redaction will be applied to send or downloads.'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="actions-row">
          {isSession && !isFinalized && (
            <button
              className="btn btn-primary"
              disabled={noneSel || busy}
              onClick={sendToAI}
            >
              {busy && status === 'sending'
                ? 'Encrypting & sending…'
                : `Send ${selCount} record${selCount !== 1 ? 's' : ''} to AI`}
            </button>
          )}
          <span className="actions-row-tip">
            <button
              className="btn btn-ghost"
              disabled={noneSel || busy}
              onClick={downloadJson}
            >
              Download JSON
            </button>
          </span>
          <span className="actions-row-tip">
            <button
              className="btn btn-ghost"
              disabled={noneSel || busy}
              onClick={downloadSkillZip}
            >
              {`Download AI Skill with ${selCount} record${selCount !== 1 ? 's' : ''}`}
            </button>
            <InfoTip text="Builds a zip with AI instructions plus your selected health records bundled in. Give this to any AI to analyze your data - no web access needed." />
          </span>
        </div>
      </div>
    </div>
  );
}
