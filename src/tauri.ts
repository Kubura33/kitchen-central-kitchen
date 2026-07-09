/**
 * Tauri desktop integration. The same bundle runs in a plain browser (the
 * hosted dashboard) and inside the Tauri webview (the kitchen desktop app);
 * everything here silently no-ops in the browser.
 */

export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

/**
 * Checks the release feed once at launch and, when a newer version exists,
 * installs it and relaunches. Failures (offline, feed unreachable) are
 * swallowed — the dashboard just starts with its current version and will
 * try again on the next launch.
 */
export async function applyPendingUpdate(): Promise<void> {
  if (!isTauri()) return
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (update === null) return
    await update.downloadAndInstall()
    // On Windows the installer exits the app by itself; relaunch covers the
    // platforms where it does not.
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch {
    // Never block the dashboard on updater problems.
  }
}
