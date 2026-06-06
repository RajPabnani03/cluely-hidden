//! IPC layer — the typed commands exposed to the React frontend.
//! Every `#[tauri::command]` here has a corresponding wrapper in
//! `src/lib/tauri.ts`.

pub mod commands;
