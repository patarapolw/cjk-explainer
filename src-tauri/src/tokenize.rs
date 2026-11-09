use tauri::State;

use crate::{AppState, error::AppError, query_tokenizer::Lang};

#[tauri::command]
pub async fn segment(
    lang: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    Ok(state
        .tokenizer_mapper
        .segment(
            Lang::from(lang).ok_or(AppError::UnsupportedLanguageError(lang.to_string()))?,
            text,
        )
        .await?)
}

#[tauri::command]
pub async fn tokenize(
    lang: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    Ok(state
        .tokenizer_mapper
        .tokenize(
            Lang::from(lang).ok_or(AppError::UnsupportedLanguageError(lang.to_string()))?,
            text,
        )
        .await?)
}
