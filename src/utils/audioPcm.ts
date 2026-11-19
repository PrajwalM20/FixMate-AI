/**
 * Pure PCM16 audio encoding/decoding utilities for Gemini Live API streaming.
 * - Input: Float32Array (browser Web Audio, -1.0..1.0) -> 16-bit PCM little-endian base64
 * - Output: 16-bit PCM little-endian base64 -> Float32Array (-1.0..1.0)
 */

export function float32ToPcm16Base64(float32Samples: Float32Array): string {
  const pcm16 = new Int16Array(float32Samples.length);
  for (let i = 0; i < float32Samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float32Samples[i]));
    pcm16[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}

export function base64Pcm16ToFloat32(base64: string): Float32Array {
  let bytes: Uint8Array;
  if (typeof atob === 'function') {
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = view.getInt16(i * 2, true);
    float32[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
  }
  return float32;
}
