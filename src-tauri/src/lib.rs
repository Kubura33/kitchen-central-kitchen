use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

/// Desktop shell for the kitchen dashboard.
///
/// The webview loads the same Vue bundle as the hosted page; this shell only
/// adds appliance behavior: a single always-focused instance and launch on
/// login. Updates are manual — install a newer .exe over the old one.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // A second launch just brings the running dashboard forward.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            // The kitchen machine should boot straight into the dashboard;
            // enabling on every start also repairs a removed registry entry.
            let _ = app.autolaunch().enable();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
