/**
 * Platform detection utilities for Tauri / Web dual-mode support.
 */

let _isTauri: boolean | null = null

export function isTauri(): boolean {
  if (_isTauri === null) {
    _isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  }
  return _isTauri
}
