import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useRecordsStore } from '../store/records';
import StatusMessage from '../components/StatusMessage';
import FetchProgressWidget from '../components/FetchProgressWidget';

/**
 * Module-level set of state nonces we've already started processing.
 * Survives React StrictMode double-mount without being cleared.
 */
const processingStates = new Set<string>();

/**
 * OAuthCallbackPage - receives the OAuth redirect, exchanges the code,
 * fetches FHIR data via the records store, and redirects back.
 *
 * Status is driven entirely from the records store (statusMessage).
 * Only `errorMsg` is local - for pre-store errors (missing params, expired OAuth).
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const statusMessage = useRecordsStore((s) => s.statusMessage);
  const completeOAuthAuthorization = useRecordsStore((s) => s.completeOAuthAuthorization);
  const connectionState = useRecordsStore((s) => s.connectionState);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const startedRef = useRef(false);

  // The state nonce from the query string
  const stateNonce = searchParams.get('state');

  useEffect(() => {
    // Guard: only process once, even across StrictMode double-mount
    if (startedRef.current) return;
    if (stateNonce && processingStates.has(stateNonce)) return;
    startedRef.current = true;
    if (stateNonce) processingStates.add(stateNonce);

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    void (async () => {
      try {
        const result = await completeOAuthAuthorization({
          code,
          stateNonce,
          errorParam,
          errorDescription: errorDesc,
        });
        if (result.error) {
          setErrorMsg(result.error);
          return;
        }
        if (result.redirectTo) {
          navigate(result.redirectTo, { replace: true });
          return;
        }
        setErrorMsg('Failed to determine redirect target.');
      } finally {
        // Allow reprocessing if user manually navigates back
        if (stateNonce) processingStates.delete(stateNonce);
      }
    })();
  }, [completeOAuthAuthorization, navigate, searchParams, stateNonce]);

  // Find active fetch progress from any connection being refreshed
  const activeFetchProgress = Object.values(connectionState).find(
    cs => cs.refreshing && cs.refreshProgress
  )?.refreshProgress ?? null;

  const displayStatus = statusMessage || 'Retrieving health records…';

  return (
    <div className="page-centered">
      <div className="panel">
        <div className="page-title">Retrieving health records</div>

        {errorMsg ? (
          <>
            <div className="alert alert-error" style={{ marginBottom: 12 }}>{errorMsg}</div>
            <button className="btn btn-secondary" onClick={() => navigate('/records')}>
              Back to records
            </button>
          </>
        ) : activeFetchProgress ? (
          <>
            <FetchProgressWidget progress={activeFetchProgress} />
            <p className="security-info">This can take a while for large records.</p>
          </>
        ) : (
          <>
            <StatusMessage status="loading" message={displayStatus} />
            <p className="security-info">This can take a while for large records.</p>
          </>
        )}
      </div>
    </div>
  );
}
