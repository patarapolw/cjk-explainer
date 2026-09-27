use lindera::{dictionary::load_dictionary, mode::Mode, segmenter::Segmenter};
use lindera_analysis::tokenizer::Tokenizer;
use tauri::{Manager, State};

use crate::error::AppError;

mod command;
mod db;
mod error;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
async fn greet(name: &str) -> Result<String, String> {
    Ok(format!("Hello, {}! You've been greeted from Rust!", name))
}

#[tauri::command]
async fn segment_ja(
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let mut out = vec![];

    let mut tokens = state.tokenizer_ja.tokenize(text)?;
    for token in tokens.iter_mut() {
        out.push((
            token.surface.to_string(),
            token.details().iter().map(|s| s.to_string()).collect(),
        ));
    }

    Ok(out)
}

#[tauri::command]
async fn segment_zh(
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let mut out = vec![];

    let mut tokens = state.tokenizer_zh.tokenize(text)?;
    for token in tokens.iter_mut() {
        out.push((
            token.surface.to_string(),
            token.details().iter().map(|s| s.to_string()).collect(),
        ));
    }

    Ok(out)
}

#[tauri::command]
async fn segment_ko(
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let mut out = vec![];

    let mut tokens = state
        .tokenizer_ko
        .segment(std::borrow::Cow::Borrowed(text))?;
    for token in tokens.iter_mut() {
        out.push((
            token.surface.to_string(),
            token.details().iter().map(|s| s.to_string()).collect(),
        ));
    }

    Ok(out)
}

struct AppState {
    tokenizer_ja: Tokenizer,
    tokenizer_zh: Tokenizer,
    tokenizer_ko: Segmenter,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:explainer.db", db::explainer_migrations())
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let tokenizer_ja = {
                let dictionary = load_dictionary("embedded://ipadic-neologd")?;
                Tokenizer::new(Segmenter::new(Mode::Normal, dictionary, None))
            };

            let tokenizer_zh = {
                let dictionary = load_dictionary("embedded://jieba")?;
                Tokenizer::new(Segmenter::new(Mode::Normal, dictionary, None))
            };

            let tokenizer_ko = {
                let dictionary = load_dictionary("embedded://ko-dic")?;
                Segmenter::new(Mode::Normal, dictionary, None)
            };

            app.manage(AppState {
                tokenizer_ja,
                tokenizer_zh,
                tokenizer_ko,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            segment_ja,
            segment_zh,
            segment_ko,
            command::import_yomitan_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
