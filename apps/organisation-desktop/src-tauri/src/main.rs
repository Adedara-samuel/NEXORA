// NEXORA Organisation Desktop — native shell entry point.
//
// Deliberately minimal in Phase 1: no custom Tauri commands yet. Native
// integrations (printing, filesystem/scanner access, secure local session
// storage, desktop notifications — see architecture section 7) are added
// as the business modules that need them are built, starting Phase 4.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running NEXORA desktop application");
}
