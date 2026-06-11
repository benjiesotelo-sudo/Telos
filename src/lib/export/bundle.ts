import { zipSync } from 'fflate'
// Typed buffer return: Uint8Array<ArrayBufferLike> is not assignable to BlobPart under TS 6.
export function buildBundle(files: Record<string, Uint8Array>): Uint8Array<ArrayBuffer> { return zipSync(files) as Uint8Array<ArrayBuffer> }
