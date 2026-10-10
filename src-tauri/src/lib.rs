use tauri::Manager;
use yomitan_parser::tokenize::TokenizerMapper;

mod db;
mod download;
mod error;
mod shared;
mod tokenize;
mod yomitan;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
struct AppState {
    tokenizer_mapper: TokenizerMapper,
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
            let app_data_dir = app.handle().path().app_data_dir()?;

            app.manage(AppState {
                tokenizer_mapper: TokenizerMapper::new(app_data_dir.join("lindera")),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            download::download_url,
            download::unzip,
            download::download_and_unzip,
            tokenize::segment,
            tokenize::tokenize,
            yomitan::yomitan_parse_zip,
            yomitan::yomitan_parse_dir,
            yomitan::yomitan_make_ndjson,
            yomitan::yomitan_import,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
