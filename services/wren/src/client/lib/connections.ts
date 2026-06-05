// Persistent EHR connections stored in IndexedDB.
// These survive across sessions - the user's "health data wallet."
//
// Uses a SEPARATE IndexedDB database from session storage so that
// clearing session data doesn't blow away saved connections.

import type { ProcessedAttachment } from './smart/attachments';

export interface SavedConnection {
  /** Unique ID for this connection (crypto.randomUUID()) */
  id: string;
  /** Human-readable provider name (e.g., "Epic Sandbox - Camila Lopez") */
  providerName: string;
  /** FHIR base URL */
  fhirBaseUrl: string;
  /** OAuth token endpoint */
  tokenEndpoint: string;
  /** Client ID used for this connection */
  clientId: string;
  /** FHIR Patient ID */
  patientId: string;
  /** Refresh token (rolling - MUST be updated after each use) */
  refreshToken: string;
  /** Whether this connection can be refreshed without re-auth */
  canRefresh?: boolean;
  /** Scopes that were granted */
  scopes: string;
  /** When the connection was first established */
  createdAt: string; // ISO 8601
  /** When the refresh token was last used/updated */
  lastRefreshedAt: string; // ISO 8601
  /** When data was last fetched via this connection */
  lastFetchedAt: string | null;
  /** Approximate size of cached FHIR data in bytes (null = no data cached) */
  dataSizeBytes: number | null;
  /** Status */
  status: 'active' | 'expired' | 'error';
  /** Error message if status is 'error' */
  lastError?: string;
  /** Patient display name extracted from FHIR Patient resource */
  patientDisplayName?: string | null;
  /** Patient birth date extracted from FHIR Patient resource (YYYY-MM-DD) */
  patientBirthDate?: string | null;
  /** Cached resource-type counts for fast browser startup */
  cachedResourceTypeCounts?: Record<string, number> | null;
  /** Cached attachment count for fast browser startup */
  cachedAttachmentCount?: number | null;
}

/** FHIR data cached for a connection. Stored separately from metadata because it can be huge. */
export interface CachedFhirData {
  /** Connection ID this data belongs to */
  connectionId: string;
  /** The FHIR resources, keyed by resource type */
  fhir: Record<string, any[]>;
  /** Extracted attachments grouped by source resource */
  attachments: ProcessedAttachment[];
  /** When this data was fetched */
  fetchedAt: string; // ISO 8601
}

const CONNECTIONS_DB = 'health_skillz_connections';
const CONNECTIONS_STORE = 'connections';
const FHIR_DATA_STORE = 'fhir_data';
const DB_VERSION = 2; // v2 adds fhir_data store

// === IndexedDB helpers ===

function openConnectionsDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CONNECTIONS_DB, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CONNECTIONS_STORE)) {
        const store = db.createObjectStore(CONNECTIONS_STORE, { keyPath: 'id' });
        store.createIndex('endpoint_patient', ['fhirBaseUrl', 'patientId'], {
          unique: false,
        });
        store.createIndex('lastRefreshedAt', 'lastRefreshedAt', {
          unique: false,
        });
      }
      // v2: add fhir_data store for cached health records
      if (!db.objectStoreNames.contains(FHIR_DATA_STORE)) {
        db.createObjectStore(FHIR_DATA_STORE, { keyPath: 'connectionId' });
      }
    };
  });
}

// === Public API ===

/** Upsert a connection (insert or overwrite by id). */
export async function saveConnection(conn: SavedConnection): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const request = store.put(conn);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/** Get a single connection by ID, or null if not found. */
export async function getConnection(
  id: string,
): Promise<SavedConnection | null> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readonly');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as SavedConnection) ?? null);
    tx.oncomplete = () => db.close();
  });
}

/** List all connections, sorted by lastRefreshedAt descending (most recent first). */
export async function getAllConnections(): Promise<SavedConnection[]> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readonly');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const connections = request.result as SavedConnection[];
      // Sort descending by lastRefreshedAt (most recently refreshed first)
      connections.sort(
        (a, b) =>
          new Date(b.lastRefreshedAt).getTime() -
          new Date(a.lastRefreshedAt).getTime(),
      );
      resolve(connections);
    };
    tx.oncomplete = () => db.close();
  });
}

/**
 * Atomically update a connection's refresh token and lastRefreshedAt timestamp.
 * This is the critical path for rolling refresh tokens - fails loudly if the
 * connection doesn't exist.
 */
export async function updateConnectionToken(
  id: string,
  newRefreshToken: string,
): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const conn = getReq.result as SavedConnection | undefined;
      if (!conn) {
        // Abort the transaction - nothing was written
        tx.abort();
        reject(
          new Error(
            `updateConnectionToken: connection "${id}" not found`,
          ),
        );
        return;
      }

      conn.refreshToken = newRefreshToken;
      conn.canRefresh = true;
      conn.lastRefreshedAt = new Date().toISOString();
      conn.status = 'active';
      // Clear any previous error on successful refresh
      delete conn.lastError;

      const putReq = store.put(conn);
      putReq.onerror = () => reject(putReq.error);
      putReq.onsuccess = () => resolve();
    };

    tx.onerror = () => {
      // Don't double-reject if we already rejected from the abort
      if (tx.error?.name !== 'AbortError') {
        reject(tx.error);
      }
    };
    tx.oncomplete = () => db.close();
  });
}

/** Mark a connection as expired or error with an optional message. */
export async function updateConnectionStatus(
  id: string,
  status: SavedConnection['status'],
  error?: string,
): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error);
    getReq.onsuccess = () => {
      const conn = getReq.result as SavedConnection | undefined;
      if (!conn) {
        tx.abort();
        reject(
          new Error(
            `updateConnectionStatus: connection "${id}" not found`,
          ),
        );
        return;
      }

      conn.status = status;
      if (error !== undefined) {
        conn.lastError = error;
      } else {
        delete conn.lastError;
      }

      const putReq = store.put(conn);
      putReq.onerror = () => reject(putReq.error);
      putReq.onsuccess = () => resolve();
    };

    tx.onerror = () => {
      if (tx.error?.name !== 'AbortError') {
        reject(tx.error);
      }
    };
    tx.oncomplete = () => db.close();
  });
}

/** Remove a single connection by ID. */
export async function deleteConnection(id: string): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readwrite');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

/** Delete ALL connections and their cached FHIR data. Nuclear option. */
export async function deleteAllConnections(): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONNECTIONS_STORE, FHIR_DATA_STORE], 'readwrite');
    tx.objectStore(CONNECTIONS_STORE).clear();
    tx.objectStore(FHIR_DATA_STORE).clear();
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

/**
 * Find an existing connection for the same patient at the same FHIR endpoint.
 * Useful for avoiding duplicate connections after re-auth.
 * Returns the first active match, or the first match of any status if none are active.
 */
export async function findConnectionByEndpoint(
  fhirBaseUrl: string,
  patientId: string,
): Promise<SavedConnection | null> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONNECTIONS_STORE, 'readonly');
    const store = tx.objectStore(CONNECTIONS_STORE);
    const index = store.index('endpoint_patient');
    const request = index.getAll([fhirBaseUrl, patientId]);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const matches = request.result as SavedConnection[];
      if (matches.length === 0) {
        resolve(null);
        return;
      }
      // Prefer active connections
      const active = matches.find((c) => c.status === 'active');
      resolve(active ?? matches[0]);
    };
    tx.oncomplete = () => db.close();
  });
}

// === Cached FHIR data ===

/**
 * Save FHIR data for a connection. Also updates the connection's
 * lastFetchedAt and dataSizeBytes in one transaction.
 */
export async function saveFhirData(
  connectionId: string,
  fhir: Record<string, any[]>,
  attachments: ProcessedAttachment[],
): Promise<void> {
  const now = new Date().toISOString();
  const data: CachedFhirData = {
    connectionId,
    fhir,
    attachments,
    fetchedAt: now,
  };

  // Estimate size (rough but good enough for UI)
  const sizeEstimate = JSON.stringify(data).length;
  const resourceTypeCounts: Record<string, number> = {};
  for (const [resourceType, resources] of Object.entries(fhir || {})) {
    if (!Array.isArray(resources) || resources.length === 0) continue;
    resourceTypeCounts[resourceType] = resources.length;
  }
  const attachmentCount = attachments.length;

  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONNECTIONS_STORE, FHIR_DATA_STORE], 'readwrite');

    // Save the data
    const dataStore = tx.objectStore(FHIR_DATA_STORE);
    dataStore.put(data);

    // Update connection metadata
    const connStore = tx.objectStore(CONNECTIONS_STORE);
    const getReq = connStore.get(connectionId);
    getReq.onsuccess = () => {
      const conn = getReq.result as SavedConnection | undefined;
      if (conn) {
        conn.lastFetchedAt = now;
        conn.dataSizeBytes = sizeEstimate;
        conn.cachedResourceTypeCounts = resourceTypeCounts;
        conn.cachedAttachmentCount = attachmentCount;
        connStore.put(conn);
      }
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}

/** Get cached FHIR data for a connection, or null if none cached. */
export async function getFhirData(
  connectionId: string,
): Promise<CachedFhirData | null> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FHIR_DATA_STORE, 'readonly');
    const store = tx.objectStore(FHIR_DATA_STORE);
    const request = store.get(connectionId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () =>
      resolve((request.result as CachedFhirData) ?? null);
    tx.oncomplete = () => db.close();
  });
}

/** Delete cached FHIR data for a connection. */
export async function clearFhirData(connectionId: string): Promise<void> {
  const db = await openConnectionsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONNECTIONS_STORE, FHIR_DATA_STORE], 'readwrite');

    // Delete the data
    tx.objectStore(FHIR_DATA_STORE).delete(connectionId);

    // Clear size on the connection
    const connStore = tx.objectStore(CONNECTIONS_STORE);
    const getReq = connStore.get(connectionId);
    getReq.onsuccess = () => {
      const conn = getReq.result as SavedConnection | undefined;
      if (conn) {
        conn.lastFetchedAt = null;
        conn.dataSizeBytes = null;
        conn.cachedResourceTypeCounts = null;
        conn.cachedAttachmentCount = null;
        connStore.put(conn);
      }
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => { db.close(); resolve(); };
  });
}
