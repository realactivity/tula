// API client for health-skillz server

import type { VendorConfig } from './brands/types';
import type { EncryptedChunk } from './crypto';

export interface PendingChunkInfo {
  receivedChunks: number[];
  totalChunks: number;
}

export interface SessionInfo {
  sessionId: string;
  publicKey: JsonWebKey;
  status: string;
  providerCount: number;
  /** Per-provider pending chunk state, keyed by providerKey. */
  pendingChunks?: Record<string, PendingChunkInfo> | null;
  attemptMeta?: UploadAttemptMeta | null;
  hasFinalizeToken?: boolean;
}

export interface Provider {
  name: string;
  connectedAt: string;
}

export interface UploadAttemptMeta {
  attemptId: string;
  selectedProviderKeys: string[];
  status: 'active' | 'finalized';
  createdAt: string;
}

const BASE_URL = '';  // Same-origin API

export async function getSessionInfo(sessionId: string): Promise<SessionInfo> {
  const res = await fetch(`${BASE_URL}/api/session/${sessionId}`);
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Session not found or expired' : 'Failed to get session');
  }
  return res.json();
}

export interface UploadProgress {
  loaded: number;
  total: number;
}

// Upload a single chunk with progress
function uploadChunk(
  url: string,
  body: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({ loaded: e.loaded, total: e.total });
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${xhr.responseText.slice(0, 100)}`));
        }
      } else {
        let errorId = '';
        try {
          const errJson = JSON.parse(xhr.responseText);
          errorId = errJson.errorId ? ` [${errJson.errorId}]` : '';
        } catch (e) {}
        reject(new Error(`Server returned ${xhr.status}${errorId}: ${xhr.responseText.slice(0, 200)}`));
      }
    });
    
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
    
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 120000;
    xhr.send(body);
  });
}

/**
 * Upload a single encrypted chunk with retry logic.
 * Retries up to 3 times with exponential backoff on transient failures.
 */
export async function uploadEncryptedChunk(
  sessionId: string,
  finalizeToken: string,
  attemptId: string,
  chunk: EncryptedChunk,
  chunkIndex: number,
  totalChunks: number | null, // null if unknown yet
  providerKey: string,
): Promise<any> {
  const body = JSON.stringify({
    sessionId,
    finalizeToken,
    attemptId,
    version: 3,
    totalChunks: totalChunks ?? -1, // -1 means "more coming, count unknown"
    chunk,
    providerKey,
  });
  
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await uploadChunk(`${BASE_URL}/api/receive-ehr`, body);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Don't retry on 4xx errors (client errors)
      if (lastError.message.includes('Server returned 4')) {
        throw lastError;
      }
      
      // Retry on 5xx, network errors, timeouts
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`Chunk ${chunkIndex} upload failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  throw lastError ?? new Error('Upload failed after retries');
}

export async function finalizeSession(
  sessionId: string,
  finalizeToken?: string,
  attemptId?: string
): Promise<{ success: boolean; providerCount: number }> {
  const res = await fetch(`${BASE_URL}/api/finalize/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalizeToken, attemptId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Server returned ${res.status}`);
  }
  return res.json();
}

export async function startUploadAttempt(
  sessionId: string,
  finalizeToken: string,
  selectedProviderKeys: string[]
): Promise<{ success: boolean; attemptMeta: UploadAttemptMeta; pendingChunks: Record<string, PendingChunkInfo> }> {
  const res = await fetch(`${BASE_URL}/api/upload/start/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalizeToken, selectedProviderKeys }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Server returned ${res.status}`);
  }
  return res.json();
}

export async function resetUploadState(
  sessionId: string,
  finalizeToken: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/api/upload/reset/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ finalizeToken }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Server returned ${res.status}`);
  }
  return res.json();
}

// Skill template for local skill building
export interface SkillTemplate {
  skillMd: string;
  references: Record<string, string>;
}

export async function getSkillTemplate(): Promise<SkillTemplate> {
  const res = await fetch(`${BASE_URL}/api/skill-template`);
  if (!res.ok) {
    throw new Error('Failed to fetch skill template');
  }
  return res.json();
}

// Get vendor configs without a session (for local collection)
export async function getVendorConfigs(): Promise<Record<string, VendorConfig>> {
  // Use a dummy session request to get vendor configs
  // The server returns vendors in the session info, but we don't need a real session
  const res = await fetch(`${BASE_URL}/api/vendors`);
  if (!res.ok) {
    throw new Error('Failed to fetch vendor configs');
  }
  return res.json();
}

// Log client-side error to server (non-sensitive diagnostic info)
export interface ClientErrorInfo {
  sessionId?: string;
  errorCode?: string;
  httpStatus?: number;
  context?: string;
}

export async function logClientError(info: ClientErrorInfo): Promise<{ logged: boolean; errorId?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...info,
        userAgent: navigator.userAgent,
      }),
    });
    return res.json();
  } catch (e) {
    // Don't throw - error logging should never break the app
    return { logged: false };
  }
}
