// Re-export for backwards-compat — all logic lives in hex-encode.ts
export { decodeFrame, encodeFrame, FRAME_TYPE_MAP, FRAME_TYPE_REVERSE } from './hex-encode';
export type { DecodedFrame, FrameType } from './hex-encode';
