use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use lindera::segmenter::Segmenter;
use lindera_analysis::tokenizer::Tokenizer;
use tauri::Manager;

mod command;
mod db;
mod download;
mod error;
mod tokenize;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
struct AppState {
    segmenter: Mutex<HashMap<String, Arc<Segmenter>>>,
    tokenizer: Mutex<HashMap<String, Arc<Tokenizer>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:explainer.db", db::explainer_migrations())
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(AppState {
                segmenter: Mutex::new(HashMap::new()),
                tokenizer: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download::download_url,
            download::unzip,
            tokenize::segment,
            tokenize::tokenize,
            command::import_yomitan_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
