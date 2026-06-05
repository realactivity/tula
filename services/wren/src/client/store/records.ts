import { create } from 'zustand';
import {
  getAllConnections,
  saveConnection,
  deleteConnection as deleteConnectionFromDB,
  clearFhirData,
  getFhirData,
  saveFhirData,
  updateConnectionToken,
  updateConnectionStatus,
  findConnectionByEndpoint,
  type SavedConnection,
  type CachedFhirData,
} from '../lib/connections';
import { exchangeCodeForToken, refreshAccessToken } from '../lib/smart/oauth';
import {
  saveFinalizeToken,
  loadFinalizeToken,
  clearFinalizeToken,
  loadOAuthState,
  clearOAuthState,
  saveSessionSelection,
  loadSessionSelection,
  clearSessionSelection,
  saveUploadAttemptId,
  loadUploadAttemptId,
  clearUploadAttemptId,
} from '../lib/storage';
import { fetchPatientData, type FetchProgress } from '../lib/smart/client';
import {
  encryptAndUploadStreaming,
  type StreamingProgress,
  type EncryptedChunk,
} from '../lib/crypto';
import { buildLocalSkillZip } from '../lib/skill-builder';
import type { UploadProgress, ProviderUploadState } from '../components/UploadProgressWidget';
import {
  getRedactionContextForAction,
  redactPayloadWithProfile,
} from '../lib/redaction';
import {
  uploadEncryptedChunk,
  finalizeSession as finalizeSess,
  getSessionInfo,
  getVendorConfigs,
  startUploadAttempt,
  resetUploadState,
} from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GlobalStatus =
  | 'idle'
  | 'loading'          // initial load from IndexedDB
  | 'refreshing'       // refreshing one or more connections
  | 'sending'          // encrypting + uploading to AI
  | 'finalizing'       // finalizing session
  | 'done'             // send/finalize completed
  | 'error';

export interface ConnectionState {
  /** Per-connection transient UI state */
  refreshing: boolean;
  refreshProgress: FetchProgress | null;
  error: string | null;
  /** Set after a successful refresh so the user can see the final progress before dismissing */
  doneMessage: string | null;
}

export interface SessionContext {
  sessionId: string;
  publicKeyJwk: JsonWebKey;
  finalizeToken: string;
  sessionStatus: string; // from server: 'pending', 'has_data', 'finalized'
  pendingChunks: Record<string, { receivedChunks: number[]; totalChunks: number }> | null;
  attemptId: string | null;
  attemptSelectedProviderKeys: string[];
}

interface RecordsState {
  // --- Connections (the persistent data) ---
  connections: SavedConnection[];
  /** Per-connection transient state, keyed by connection ID */
  connectionState: Record<string, ConnectionState>;

  // --- Selection (for session mode) ---
  selected: Set<string>;

  // --- Session context (null = standalone mode) ---
  session: SessionContext | null;

  // --- Global status ---
  status: GlobalStatus;
  statusMessage: string;
  error: string | null;

  // --- Upload progress (structured, for UploadProgressWidget) ---
  uploadProgress: UploadProgress | null;

  // --- Flags ---
  loaded: boolean;
}

interface RecordsActions {
  // Lifecycle
  loadConnections: () => Promise<void>;
  initSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;

  // Selection
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  selectNone: () => void;

  // Connection CRUD
  refreshConnection: (id: string) => Promise<void>;
  reconnectConnection: (id: string) => Promise<void>;
  dismissConnectionDone: (id: string) => void;
  removeConnection: (id: string) => Promise<void>;
  /** Save a new/updated connection + its FHIR data (called after OAuth callback) */
  saveNewConnection: (params: {
    providerName: string;
    fhirBaseUrl: string;
    tokenEndpoint: string;
    clientId: string;
    patientId: string;
    refreshToken: string;
    scopes: string;
    accessToken: string;
  }) => Promise<string>; // returns connection ID
  completeOAuthAuthorization: (params: {
    code: string | null;
    stateNonce: string | null;
    errorParam: string | null;
    errorDescription: string | null;
  }) => Promise<{ redirectTo: string | null; error: string | null }>;

  // Session actions
  sendToAI: () => Promise<void>;
  finalizeSession: () => Promise<void>;

  // Export
  downloadJson: () => Promise<void>;
  downloadSkillZip: () => Promise<void>;

  // Status
  setError: (msg: string) => void;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive an opaque, session-scoped provider key from the session ID and
 * connection ID.  The result is deterministic (so it survives page reload)
 * but different for every session, preventing cross-session correlation.
 */
async function deriveProviderKey(sessionId: string, connectionId: string): Promise<string> {
  const data = new TextEncoder().encode(`${sessionId}:${connectionId}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  // 16 hex chars (64 bits) is plenty for a grouping key
  return Array.from(new Uint8Array(hash).slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
}

function extractPatientIdentity(fhir: Record<string, any[]>): {
  displayName: string | null;
  birthDate: string | null;
} {
  const patients = fhir['Patient'] || [];
  if (patients.length === 0) return { displayName: null, birthDate: null };
  const pt = patients[0];
  const name = pt.name?.[0];
  const display = name
    ? [name.given?.join(' '), name.family].filter(Boolean).join(' ')
    : null;
  return {
    displayName: display || pt.id || null,
    birthDate: pt.birthDate || null,
  };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRecordsStore = create<RecordsState & RecordsActions>((set, get) => ({
  // Initial state
  connections: [],
  connectionState: {},
  selected: new Set<string>(),
  session: null,
  status: 'idle',
  statusMessage: '',
  error: null,
  uploadProgress: null,
  loaded: false,

  // -----------------------------------------------------------------------
  // loadConnections - read all from IndexedDB
  // -----------------------------------------------------------------------
  loadConnections: async () => {
    set({ status: 'loading', statusMessage: 'Loading saved connections…' });
    try {
      const conns = await getAllConnections();
      const connState: Record<string, ConnectionState> = {};
      for (const c of conns) {
        connState[c.id] = { refreshing: false, refreshProgress: null, error: null, doneMessage: null };
      }

      // Pre-select connections with cached data (both modes)
      const selected = new Set(
        conns.filter(c => c.dataSizeBytes && c.dataSizeBytes > 0).map(c => c.id)
      );

      set({
        connections: conns,
        connectionState: connState,
        selected,
        status: 'idle',
        statusMessage: '',
        loaded: true,
      });

      // Backfill lightweight type/attachment summaries for older cached records
      // so Data Browser can show content-type pills without waiting for full parse.
      void (async () => {
        const targets = conns.filter((conn) =>
          (conn.dataSizeBytes || 0) > 0 &&
          (!conn.cachedResourceTypeCounts || typeof conn.cachedAttachmentCount !== 'number'),
        );
        for (const conn of targets) {
          try {
            const cached = await getFhirData(conn.id);
            if (!cached) continue;
            const counts: Record<string, number> = {};
            for (const [resourceType, resources] of Object.entries(cached.fhir || {})) {
              if (!Array.isArray(resources) || resources.length === 0) continue;
              counts[resourceType] = resources.length;
            }
            const attachmentCount = Array.isArray(cached.attachments) ? cached.attachments.length : 0;
            const updated = {
              ...conn,
              cachedResourceTypeCounts: counts,
              cachedAttachmentCount: attachmentCount,
            };
            await saveConnection(updated);
            set((state) => ({
              connections: state.connections.map((existing) =>
                existing.id === conn.id ? updated : existing,
              ),
            }));
          } catch {
            // Ignore backfill failures; this is a non-critical perf optimization.
          }
        }
      })();
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        loaded: true,
      });
    }
  },

  // -----------------------------------------------------------------------
  // initSession - fetch session info from server, set session context
  // -----------------------------------------------------------------------
  initSession: async (sessionId: string) => {
    try {
      const info = await getSessionInfo(sessionId);
      // Restore persisted token so uploads/finalize survive page reloads.
      // If server already has upload state and token is missing locally,
      // fail loudly instead of silently rotating to a new token.
      let token = loadFinalizeToken(sessionId);
      const requiresTokenContinuity = Boolean(
        info.status !== 'finalized' && (
          info.status === 'collecting' ||
          (info.pendingChunks && Object.keys(info.pendingChunks).length > 0) ||
          (info.attemptMeta && info.attemptMeta.status === 'active') ||
          info.hasFinalizeToken
        )
      );
      if (!token) {
        if (requiresTokenContinuity) {
          throw new Error('Session token missing locally. Ask your AI assistant to create a new session link.');
        }
        token = crypto.randomUUID();
        saveFinalizeToken(sessionId, token);
      }
      if (info.attemptMeta?.attemptId) {
        saveUploadAttemptId(sessionId, info.attemptMeta.attemptId);
      } else {
        clearUploadAttemptId(sessionId);
      }
      set({
        session: {
          sessionId,
          publicKeyJwk: info.publicKey,
          finalizeToken: token,
          sessionStatus: info.status,
          pendingChunks: info.pendingChunks ?? null,
          attemptId: info.attemptMeta?.attemptId || loadUploadAttemptId(sessionId),
          attemptSelectedProviderKeys: info.attemptMeta?.selectedProviderKeys ?? [],
        },
      });
      // Load connections atomically after session init
      await get().loadConnections();
      const savedSelection = loadSessionSelection(sessionId);
      if (savedSelection) {
        const validIds = new Set(get().connections.map(c => c.id));
        const restored = new Set(savedSelection.filter(id => validIds.has(id)));
        set({ selected: restored });
      }
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  clearSession: () => {
    const session = get().session;
    if (session) {
      clearFinalizeToken(session.sessionId);
      clearSessionSelection(session.sessionId);
      clearUploadAttemptId(session.sessionId);
    }
    set({ session: null });
  },

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------
  toggleSelected: (id) => {
    const s = new Set(get().selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    const session = get().session;
    if (session) saveSessionSelection(session.sessionId, Array.from(s));
    set({ selected: s });
  },
  selectAll: () => {
    const all = new Set(get().connections.map(c => c.id));
    const session = get().session;
    if (session) saveSessionSelection(session.sessionId, Array.from(all));
    set({ selected: all });
  },
  selectNone: () => {
    const session = get().session;
    if (session) saveSessionSelection(session.sessionId, []);
    set({ selected: new Set() });
  },

  // -----------------------------------------------------------------------
  // refreshConnection - use refresh token to get new access, re-fetch FHIR
  // -----------------------------------------------------------------------
  refreshConnection: async (id) => {
    const { connections } = get();
    const conn = connections.find(c => c.id === id);
    if (!conn) return;
    const canRefresh = conn.canRefresh !== false && Boolean(conn.refreshToken?.trim());
    if (!canRefresh) {
      const msg = 'This connection is not refreshable (no refresh token). Reconnect to refresh data.';
      set({
        connectionState: {
          ...get().connectionState,
          [id]: { refreshing: false, refreshProgress: null, error: msg, doneMessage: null },
        },
      });
      return;
    }

    // Mark refreshing
    set({
      connectionState: {
        ...get().connectionState,
        [id]: { refreshing: true, refreshProgress: null, error: null, doneMessage: null },
      },
    });

    try {
      // 1. Refresh the access token
      const result = await refreshAccessToken(
        conn.tokenEndpoint,
        conn.clientId,
        conn.refreshToken,
      );

      // 2. MUST save rolling refresh token immediately
      if (result.refresh_token) {
        await updateConnectionToken(id, result.refresh_token);
      }

      // 3. Re-fetch FHIR data with progress
      const patientId = result.patient || conn.patientId;
      const ehrData = await fetchPatientData(
        conn.fhirBaseUrl,
        result.access_token,
        patientId,
        (progress: FetchProgress) => {
          set({
            connectionState: {
              ...get().connectionState,
              [id]: { refreshing: true, refreshProgress: progress, error: null, doneMessage: null },
            },
          });
        },
      );

      // 4. Save data + extract patient identity
      await saveFhirData(id, ehrData.fhir, ehrData.attachments);
      const { displayName, birthDate } = extractPatientIdentity(ehrData.fhir);

      // 5. Update connection metadata
      await updateConnectionStatus(id, 'active');

      // 6. Reload to get fresh state - keep final progress visible until user dismisses
      const conns = await getAllConnections();
      const lastProgress = get().connectionState[id]?.refreshProgress ?? null;
      const newState = { ...get().connectionState };
      newState[id] = {
        refreshing: false,
        refreshProgress: lastProgress,
        error: null,
        doneMessage: 'Updated',
      };
      // Update patientDisplayName/birthDate on the connection in IDB
      const updated = conns.find(c => c.id === id);
      if (updated && (displayName || birthDate)) {
        (updated as any).patientDisplayName = displayName;
        (updated as any).patientBirthDate = birthDate;
        await saveConnection(updated);
      }
      set({ connections: await getAllConnections(), connectionState: newState });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('400') || msg.includes('401') || msg.includes('invalid_grant')) {
        await updateConnectionStatus(id, 'expired', msg);
      } else {
        await updateConnectionStatus(id, 'error', msg);
      }
      set({
        connections: await getAllConnections(),
        connectionState: {
          ...get().connectionState,
          [id]: { refreshing: false, refreshProgress: null, error: msg, doneMessage: null },
        },
      });
    }
  },

  // -----------------------------------------------------------------------
  // dismissConnectionDone - clear done state + progress so widget collapses
  dismissConnectionDone: (id) => {
    const cs = get().connectionState[id];
    if (!cs) return;
    set({
      connectionState: {
        ...get().connectionState,
        [id]: { ...cs, refreshProgress: null, doneMessage: null },
      },
    });
  },

  // reconnectConnection - re-initiate OAuth for a failed/expired connection
  // Uses saved connection metadata so user doesn't have to search again.
  // Reuses the same launchOAuth path as the directory-based connect flow.
  // -----------------------------------------------------------------------
  reconnectConnection: async (id) => {
    const { connections, session } = get();
    const conn = connections.find(c => c.id === id);
    if (!conn) return;

    try {
      // Look up vendor config by clientId to get canonical scopes + redirect
      const vendorConfigs = await getVendorConfigs();
      const vendorEntry = Object.entries(vendorConfigs).find(
        ([, v]) => v.clientId === conn.clientId
      );
      if (!vendorEntry) {
        throw new Error('Vendor configuration not found for this connection');
      }
      const [, vendorConfig] = vendorEntry;

      const { launchOAuth } = await import('../lib/smart/launch');
      await launchOAuth({
        fhirBaseUrl: conn.fhirBaseUrl,
        clientId: vendorConfig.clientId,
        scopes: vendorConfig.scopes,
        redirectUri: vendorConfig.redirectUrl || `${window.location.origin}/connect/callback`,
        sessionId: session?.sessionId || 'local_' + crypto.randomUUID(),
        publicKeyJwk: session?.publicKeyJwk || null,
        providerName: conn.providerName,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        connectionState: {
          ...get().connectionState,
          [id]: { refreshing: false, refreshProgress: null, error: `Reconnect failed: ${msg}`, doneMessage: null },
        },
      });
    }
  },

  // -----------------------------------------------------------------------
  // removeConnection
  // -----------------------------------------------------------------------
  removeConnection: async (id) => {
    await clearFhirData(id);
    await deleteConnectionFromDB(id);
    const s = new Set(get().selected);
    s.delete(id);
    const newState = { ...get().connectionState };
    delete newState[id];
    set({
      connections: get().connections.filter(c => c.id !== id),
      connectionState: newState,
      selected: s,
    });
    const session = get().session;
    if (session) saveSessionSelection(session.sessionId, Array.from(s));
  },

  // -----------------------------------------------------------------------
  // saveNewConnection - called from OAuthCallbackPage after token exchange
  // Fetches FHIR data, extracts patient identity, saves everything.
  // Returns the connection ID.
  // -----------------------------------------------------------------------
  saveNewConnection: async (params) => {
    const { providerName, fhirBaseUrl, tokenEndpoint, clientId, patientId,
            refreshToken, scopes, accessToken } = params;
    const normalizedRefreshToken = refreshToken.trim();

    set({ status: 'loading', statusMessage: 'Fetching health records…' });

    // Check for existing connection (same endpoint + patient)
    const existing = await findConnectionByEndpoint(fhirBaseUrl, patientId);
    const connId = existing?.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    // Set up connection state
    set({
      connectionState: {
        ...get().connectionState,
        [connId]: { refreshing: true, refreshProgress: null, error: null, doneMessage: null },
      },
    });

    // Fetch FHIR data
    const ehrData = await fetchPatientData(
      fhirBaseUrl,
      accessToken,
      patientId,
      (progress: FetchProgress) => {
        // Derive a status message from rich progress
        const activeLabels = progress.queries
          .filter(q => q.state.status === 'active')
          .slice(0, 3)
          .map(q => q.label);
        const detail = activeLabels.length > 0 ? activeLabels.join(', ') : progress.phase;
        set({
          statusMessage: `Fetching: ${detail} (${progress.settledCount}/${progress.queries.length})`,
          connectionState: {
            ...get().connectionState,
            [connId]: { refreshing: true, refreshProgress: progress, error: null, doneMessage: null },
          },
        });
      },
    );

    // Extract patient identity
    const { displayName, birthDate } = extractPatientIdentity(ehrData.fhir);

    // Build connection object
    const conn: SavedConnection = {
      id: connId,
      providerName,
      fhirBaseUrl,
      tokenEndpoint,
      clientId,
      patientId,
      refreshToken: normalizedRefreshToken,
      canRefresh: normalizedRefreshToken.length > 0,
      scopes,
      createdAt: existing?.createdAt ?? now,
      lastRefreshedAt: now,
      lastFetchedAt: now,
      dataSizeBytes: JSON.stringify({
        fhir: ehrData.fhir,
        attachments: ehrData.attachments,
      }).length,
      status: 'active',
      patientDisplayName: displayName,
      patientBirthDate: birthDate,
    };

    // Save connection + data
    await saveConnection(conn);
    await saveFhirData(connId, ehrData.fhir, ehrData.attachments);

    console.log(`[Connection] Saved ${providerName} (${existing ? 'updated' : 'new'})`);

    // Reload and update store
    const conns = await getAllConnections();
    const connState = { ...get().connectionState };
    connState[connId] = { refreshing: false, refreshProgress: null, error: null, doneMessage: null };

    // Auto-select the new connection in session mode
    const selected = new Set(get().selected);
    if (get().session) selected.add(connId);

    set({
      connections: conns,
      connectionState: connState,
      selected,
      status: 'idle',
      statusMessage: '',
    });
    const session = get().session;
    if (session) saveSessionSelection(session.sessionId, Array.from(selected));

    return connId;
  },

  // -----------------------------------------------------------------------
  // completeOAuthAuthorization - handle callback params + token exchange
  // -----------------------------------------------------------------------
  completeOAuthAuthorization: async ({ code, stateNonce, errorParam, errorDescription }) => {
    if (errorParam) {
      return { redirectTo: null, error: errorDescription || errorParam };
    }
    if (!code || !stateNonce) {
      return { redirectTo: null, error: 'Missing authorization code or state parameter.' };
    }

    const oauth = loadOAuthState(stateNonce);
    if (!oauth) {
      return { redirectTo: null, error: 'OAuth session not found. This link may have already been used.' };
    }

    // Clear immediately to prevent replay.
    clearOAuthState(stateNonce);

    try {
      set({ status: 'loading', statusMessage: 'Completing authorization…', error: null });
      const tokenResponse = await exchangeCodeForToken(
        code,
        oauth.tokenEndpoint,
        oauth.clientId,
        oauth.redirectUri,
        oauth.codeVerifier,
      );

      const patientId = tokenResponse.patient;
      if (!patientId) {
        throw new Error('No patient ID in token response. The server may not have returned patient context.');
      }

      await get().saveNewConnection({
        providerName: oauth.providerName,
        fhirBaseUrl: oauth.fhirBaseUrl,
        tokenEndpoint: oauth.tokenEndpoint,
        clientId: oauth.clientId,
        patientId,
        refreshToken: tokenResponse.refresh_token || '',
        scopes: tokenResponse.scope || '',
        accessToken: tokenResponse.access_token,
      });

      const redirectTo = oauth.sessionId && !oauth.sessionId.startsWith('local_')
        ? `/connect/${oauth.sessionId}`
        : '/records';
      return { redirectTo, error: null };
    } catch (err) {
      return { redirectTo: null, error: err instanceof Error ? err.message : String(err) };
    }
  },

  // -----------------------------------------------------------------------
  // sendToAI - encrypt + upload selected connections' cached data
  // -----------------------------------------------------------------------
  sendToAI: async () => {
    const { session, connections, selected, status } = get();
    if (!session) throw new Error('No active session');
    if (session.sessionStatus === 'finalized') return;  // already done
    if (status === 'sending') return;  // already in progress

    const selectedConns = connections.filter(c => selected.has(c.id));
    if (selectedConns.length === 0) return;
    const redactionForSend = getRedactionContextForAction('send');

    // Show upload UI immediately so the browser doesn't feel hung while we prep.
    const initialProviderStates: ProviderUploadState[] = selectedConns.map((conn) => ({
      providerName: conn.providerName,
      estimatedChunks: 1,
      actualChunks: null,
      chunksUploaded: 0,
      chunksSkipped: 0,
      bytesIn: 0,
      totalBytesIn: 1,
      bytesOut: 0,
      status: 'pending',
      currentChunk: 0,
      chunkPhase: 'processing',
    }));
    const uploadProgress: UploadProgress = {
      providers: initialProviderStates,
      activeProviderIndex: 0,
      phase: 'uploading',
    };
    set({ status: 'sending', statusMessage: '', error: null, uploadProgress });
    await nextFrame();

    // Compression typically achieves ~3-5x on FHIR JSON; use 4x as estimate.
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const COMPRESSION_RATIO = 4;

    type UploadWorkItem = {
      conn: SavedConnection;
      data: any;
      providerKey: string;
    };
    const workItems: UploadWorkItem[] = [];

    try {
      for (let pi = 0; pi < selectedConns.length; pi++) {
        const conn = selectedConns[pi];
        const cached = await getFhirData(conn.id);
        if (!cached) {
          throw new Error(`Selected record for ${conn.providerName} is missing local data. Refresh and try again.`);
        }
        const payload = {
          name: conn.providerName,
          fhirBaseUrl: conn.fhirBaseUrl,
          connectedAt: cached.fetchedAt,
          fhir: cached.fhir,
          attachments: cached.attachments,
        };
        const data = redactionForSend.shouldApply && redactionForSend.profile
          ? redactPayloadWithProfile(payload, redactionForSend.profile)
          : payload;
        const providerKey = await deriveProviderKey(session.sessionId, conn.id);
        const estimatedInputBytes = Math.max(1, conn.dataSizeBytes || 1);
        workItems.push({ conn, data, providerKey });

        const compressedEstimate = estimatedInputBytes / COMPRESSION_RATIO;
        const estChunks = Math.max(1, Math.ceil(compressedEstimate / CHUNK_SIZE));
        initialProviderStates[pi] = {
          ...initialProviderStates[pi],
          totalBytesIn: estimatedInputBytes,
          estimatedChunks: estChunks,
        };
        set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates] } });
      }

      const latestSession = await getSessionInfo(session.sessionId);
      const selectedProviderKeys = workItems.map((w) => w.providerKey);

      let attemptId = latestSession.attemptMeta?.status === 'active' ? latestSession.attemptMeta.attemptId : null;
      let pendingChunks = latestSession.pendingChunks ?? {};
      const activeKeys = latestSession.attemptMeta?.selectedProviderKeys ?? [];
      const canResumeActiveAttempt = Boolean(
        attemptId &&
        sameStringSet(activeKeys, selectedProviderKeys)
      );

      if (canResumeActiveAttempt && attemptId) {
        saveUploadAttemptId(session.sessionId, attemptId);
      } else {
        if (attemptId && !canResumeActiveAttempt) {
          const restart = confirm(
            'Your current upload attempt is locked to a different provider selection. Start a new upload and discard partial chunks from the old attempt?'
          );
          if (!restart) {
            set({ status: 'idle', statusMessage: '', uploadProgress: null });
            return;
          }
          await resetUploadState(session.sessionId, session.finalizeToken);
        }
        const started = await startUploadAttempt(session.sessionId, session.finalizeToken, selectedProviderKeys);
        attemptId = started.attemptMeta.attemptId;
        pendingChunks = started.pendingChunks ?? {};
        saveUploadAttemptId(session.sessionId, attemptId);
      }

      set({
        session: {
          ...session,
          pendingChunks,
          attemptId,
          attemptSelectedProviderKeys: selectedProviderKeys,
        },
      });
      saveSessionSelection(session.sessionId, Array.from(selected));

      for (let pi = 0; pi < workItems.length; pi++) {
        const { conn, data, providerKey } = workItems[pi];
        const skipChunks = pendingChunks[providerKey]?.receivedChunks ?? [];
        if (skipChunks.length > 0) {
          console.log(`[Resume] Skipping ${skipChunks.length} already-uploaded chunks for ${conn.providerName}`);
        }

        // Mark this provider active
        initialProviderStates[pi] = {
          ...initialProviderStates[pi],
          status: 'active',
          chunksUploaded: skipChunks.length,
          chunksSkipped: skipChunks.length,
        };
        set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates], activeProviderIndex: pi } });

        let provChunksUploaded = skipChunks.length;

        await encryptAndUploadStreaming(
          data,
          session.publicKeyJwk,
          async (chunk: EncryptedChunk, index: number, isLast: boolean) => {
            await uploadEncryptedChunk(
              session.sessionId,
              session.finalizeToken,
              attemptId!,
              chunk,
              index,
              isLast ? index + 1 : null,
              providerKey,
            );
            provChunksUploaded++;
            initialProviderStates[pi] = {
              ...initialProviderStates[pi],
              chunksUploaded: provChunksUploaded,
              actualChunks: isLast ? index + 1 : initialProviderStates[pi].actualChunks,
            };
            set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates] } });
          },
          (progress: StreamingProgress) => {
            initialProviderStates[pi] = {
              ...initialProviderStates[pi],
              bytesIn: progress.bytesIn,
              totalBytesIn: Math.max(1, progress.totalBytesIn),
              bytesOut: progress.bytesOut,
              currentChunk: progress.currentChunk,
              chunkPhase: progress.phase === 'uploading' ? 'uploading' : progress.phase === 'done' ? 'done' : 'processing',
            };
            set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates] } });
          },
          skipChunks,
        );

        // Mark done
        initialProviderStates[pi] = { ...initialProviderStates[pi], status: 'done', chunkPhase: 'done' };
        set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates] } });
      }

      // Finalize
      set({ uploadProgress: { ...uploadProgress, providers: [...initialProviderStates], phase: 'finalizing' } });
      await finalizeSess(session.sessionId, session.finalizeToken, attemptId || undefined);
      clearFinalizeToken(session.sessionId);
      clearUploadAttemptId(session.sessionId);
      clearSessionSelection(session.sessionId);

      set({
        status: 'done',
        statusMessage: '',
        uploadProgress: { ...uploadProgress, providers: [...initialProviderStates], phase: 'done' },
        session: {
          ...session,
          sessionStatus: 'finalized',
          pendingChunks: null,
          attemptId: null,
          attemptSelectedProviderKeys: [],
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: 'error', error: msg, statusMessage: '', uploadProgress: null });
    }
  },

  // finalizeSession is now integrated into sendToAI above.
  // Keep as a no-op for any callers.
  finalizeSession: async () => {},

  // -----------------------------------------------------------------------
  // downloadJson - export all cached data
  // -----------------------------------------------------------------------
  downloadJson: async () => {
    const { connections, selected } = get();
    const selectedConns = connections.filter(c => selected.has(c.id));
    if (selectedConns.length === 0) return;
    const redactionForDownload = getRedactionContextForAction('downloadJson');

    const allData: any[] = [];
    for (const conn of selectedConns) {
      const cached = await getFhirData(conn.id);
      if (cached) {
        const payload = {
          provider: conn.providerName,
          patientDisplayName: conn.patientDisplayName || conn.patientId,
          patientBirthDate: conn.patientBirthDate || null,
          fhir: cached.fhir,
          attachments: cached.attachments,
          fetchedAt: cached.fetchedAt,
        };
        allData.push(
          redactionForDownload.shouldApply && redactionForDownload.profile
            ? redactPayloadWithProfile(payload, redactionForDownload.profile)
            : payload
        );
      }
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'health-records.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // -----------------------------------------------------------------------
  // downloadSkillZip - build a local skill zip with selected records
  // -----------------------------------------------------------------------
  downloadSkillZip: async () => {
    const { connections, selected } = get();
    const selectedConns = connections.filter(c => selected.has(c.id));
    if (selectedConns.length === 0) return;
    const redactionForSkill = getRedactionContextForAction('downloadSkill');

    set({ status: 'sending', statusMessage: 'Building skill zip…', error: null });

    try {
      const blob = await buildLocalSkillZip(
        selectedConns,
        redactionForSkill.shouldApply ? redactionForSkill.profile : null
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'health-record-assistant.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      set({ status: 'idle', statusMessage: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: 'error', error: msg, statusMessage: '' });
    }
  },

  // -----------------------------------------------------------------------
  // Status helpers
  // -----------------------------------------------------------------------
  setError: (msg) => set({ status: 'error', error: msg }),
  clearError: () => set({ status: 'idle', error: null, statusMessage: '', uploadProgress: null }),
}));
