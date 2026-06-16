import type { Emitter } from './index'

// Group-comparison family emitters land in a later task; merged empty here so index.ts has a stable import surface.
export const groupEmitters: Record<string, Emitter> = {}
export const groupPackages: Record<string, string[]> = {}
