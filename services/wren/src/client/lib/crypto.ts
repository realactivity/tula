// E2E encryption using Web Crypto API
// All data is uploaded via streaming chunked encryption (v3).

export interface EncryptedChunk {
  index: number;
  ephemeralPublicKey: JsonWebKey;
  iv: string;
  ciphertext: string;
}

export interface StreamingProgress {
  phase: 'processing' | 'uploading' | 'done';
  currentChunk: number;
  bytesIn: number;  // uncompressed input bytes processed
  totalBytesIn: number; // total input size
  bytesOut: number; // compressed+encrypted bytes sent so far
}

/**
 * Streaming encrypt and upload - processes data in chunks without holding full payload.
 * Flow: JSON → compress → 5MB chunks → encrypt → upload (per chunk)
 * 
 * Returns total chunks uploaded. Server assembles them.
 */
export async function encryptAndUploadStreaming(
  data: EncryptionInput,
  publicKeyJwk: JsonWebKey,
  uploadChunk: (chunk: EncryptedChunk, index: number, isLast: boolean) => Promise<void>,
  onProgress?: (progress: StreamingProgress) => void,
  skipChunks?: number[] // Chunk indices already uploaded (for resume)
): Promise<{ totalChunks: number }> {
  const skipSet = new Set(skipChunks || []);
  // Import recipient's public key once
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Serialize to JSON - we need the string but will stream it
  const jsonString = JSON.stringify(data);
  const totalBytesIn = jsonString.length;
  const encoder = new TextEncoder();
  
  let bytesIn = 0;
  let bytesOut = 0;
  let chunkIndex = 0;
  let buffer = new Uint8Array(0);
  
  // Process JSON in 1MB slices through compression
  const inputChunkSize = 1024 * 1024;
  
  // Helper to process and upload a complete chunk
  const processChunk = async (chunkData: Uint8Array, isLast: boolean) => {
    // Skip if already uploaded (resume case)
    if (skipSet.has(chunkIndex)) {
      console.log(`Skipping chunk ${chunkIndex} (already uploaded)`);
      bytesOut += chunkData.length;
      chunkIndex++;
      return;
    }
    
    onProgress?.({
      phase: 'uploading',
      currentChunk: chunkIndex + 1,
      bytesIn,
      totalBytesIn,
      bytesOut,
    });
    
    const encrypted = await encryptChunk(chunkData, publicKey, chunkIndex);
    await uploadChunk(encrypted, chunkIndex, isLast);
    
    bytesOut += chunkData.length;
    chunkIndex++;
  };
  
  // Stream through compression in slices
  for (let offset = 0; offset < jsonString.length; offset += inputChunkSize) {
    const slice = jsonString.slice(offset, offset + inputChunkSize);
    const sliceBytes = encoder.encode(slice);
    bytesIn = Math.min(offset + inputChunkSize, jsonString.length);
    
    onProgress?.({
      phase: 'processing',
      currentChunk: chunkIndex + 1,
      bytesIn,
      totalBytesIn,
      bytesOut,
    });
    
    // Compress this slice
    const compressed = await compress(sliceBytes);
    
    // Append to buffer
    const newBuffer = new Uint8Array(buffer.length + compressed.length);
    newBuffer.set(buffer);
    newBuffer.set(compressed, buffer.length);
    buffer = newBuffer;
    
    // Process complete chunks
    while (buffer.length >= CHUNK_SIZE) {
      const chunk = buffer.slice(0, CHUNK_SIZE);
      buffer = buffer.slice(CHUNK_SIZE);
      await processChunk(chunk, false);
    }
    
    // Yield to UI
    await new Promise(r => setTimeout(r, 0));
  }
  
  // Upload final chunk if any remaining data
  if (buffer.length > 0) {
    await processChunk(buffer, true);
  }
  
  onProgress?.({
    phase: 'done',
    currentChunk: chunkIndex,
    bytesIn: totalBytesIn,
    totalBytesIn,
    bytesOut,
  });
  
  return { totalChunks: chunkIndex };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

export async function exportPublicKey(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', keyPair.publicKey);
}

export async function exportPrivateKey(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', keyPair.privateKey);
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
}

export interface EncryptionInput {
  name: string;
  fhirBaseUrl: string;
  connectedAt: string;
  fhir: unknown;
  attachments?: unknown;
}

async function compress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  const blob = await new Response(stream).blob();
  return new Uint8Array(await blob.arrayBuffer());
}

// Chunk size: 5MB of compressed data per chunk
const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Encrypt a single chunk of compressed data.
 */
async function encryptChunk(
  compressedData: Uint8Array,
  publicKey: CryptoKey,
  index: number
): Promise<EncryptedChunk> {
  // Generate ephemeral keypair for this chunk
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  
  const ephemeralPublicKeyJwk = await crypto.subtle.exportKey(
    'jwk',
    ephemeralKeyPair.publicKey
  );
  
  // Derive shared secret
  const sharedKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    ephemeralKeyPair.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    compressedData.buffer as ArrayBuffer
  );
  
  return {
    index,
    ephemeralPublicKey: ephemeralPublicKeyJwk,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}


