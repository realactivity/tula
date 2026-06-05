import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useRecordsStore } from '../store/records';
import RecordsPage from './RecordsPage';
import StatusMessage from '../components/StatusMessage';

/**
 * ConnectPage - thin wrapper for AI sessions.
 * Loads session info from the server, sets session context in the store,
 * then renders RecordsPage (which shows checkboxes + "Send to AI").
 */
export default function ConnectPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const session = useRecordsStore((s) => s.session);
  const status = useRecordsStore((s) => s.status);
  const error = useRecordsStore((s) => s.error);
  const initSession = useRecordsStore((s) => s.initSession);

  // Initialize session context on mount
  useEffect(() => {
    if (!sessionId) return;
    // Only init if not already set (avoids re-init after OAuth redirect back)
    const current = useRecordsStore.getState().session;
    if (!current || current.sessionId !== sessionId) {
      initSession(sessionId);
    }
  }, [sessionId]);

  // Show a provider_added success flash
  const justAdded = searchParams.get('provider_added') === 'true';

  // Loading / error states
  if (!sessionId) {
    return (
      <div className="page-centered">
        <div className="panel">
          <StatusMessage status="error" message="No session ID" />
        </div>
      </div>
    );
  }

  if (!session) {
    if (status === 'error') {
      return (
        <div className="page-centered">
          <div className="panel">
            <div className="page-title">Session error</div>
            <StatusMessage status="error" message={error || 'Session not found or expired'} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 16 }}>
              This session link may have expired or been used already.
              Ask your AI assistant to create a new one, or manage your records directly.
            </p>
            <div className="actions-row" style={{ marginTop: 12 }}>
              <a href="/records" className="btn btn-primary">Go to My Health Records</a>
              <a href="/" className="btn btn-secondary">About Wren</a>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="page-centered">
        <div className="panel">
          <StatusMessage status="loading" message="Loading session…" />
        </div>
      </div>
    );
  }

  return (
    <>
      {justAdded && (
        <div className="alert alert-success" style={{ position: 'fixed', top: 0, left: 0, right: 0, borderRadius: 0, textAlign: 'center', zIndex: 100 }}>
          Provider connected.
        </div>
      )}
      <RecordsPage />
    </>
  );
}
