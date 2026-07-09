/**
 * Tauri desktop detection. The same bundle runs in a plain browser (the
 * hosted dashboard) and inside the Tauri webview (the kitchen desktop app).
 */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}
