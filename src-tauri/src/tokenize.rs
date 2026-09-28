use lindera::{dictionary::load_dictionary, mode::Mode, segmenter::Segmenter};
use lindera_analysis::tokenizer::Tokenizer;
use std::{path::PathBuf, sync::Arc};
use tauri::{AppHandle, Manager, State};

use crate::{AppState, error::AppError};

#[tauri::command]
pub async fn segment(
    app: AppHandle,
    model: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let data_dir = app.path().app_data_dir()?;
    let segmenter = get_segmenter(data_dir, model, &state)?;

    let mut out = vec![];
    let mut tokens = segmenter.segment(std::borrow::Cow::Borrowed(text))?;
    for token in tokens.iter_mut() {
        out.push((
            token.surface.to_string(),
            token.details().iter().map(|s| s.to_string()).collect(),
        ));
    }

    Ok(out)
}

#[tauri::command]
pub async fn tokenize(
    app: AppHandle,
    model: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let tokenizer = {
        let mut tokenizer_map = state.tokenizer.lock()?;
        match tokenizer_map.get(model) {
            Some(t) => Arc::clone(t),
            None => {
                let data_dir = app.path().app_data_dir()?;
                let segmenter = get_segmenter(data_dir, model, &state)?;

                let tokenizer = Arc::new(Tokenizer::new((*segmenter).clone()));
                tokenizer_map.insert(model.to_string(), Arc::clone(&tokenizer));
                tokenizer
            }
        }
    };

    let mut out = vec![];
    let mut tokens = tokenizer.tokenize(text)?;
    for token in tokens.iter_mut() {
        out.push((
            token.surface.to_string(),
            token.details().iter().map(|s| s.to_string()).collect(),
        ));
    }

    Ok(out)
}

fn get_segmenter(
    root_dir: PathBuf,
    model: &str,
    state: &AppState,
) -> Result<Arc<Segmenter>, AppError> {
    let mut segmenter_map = state.segmenter.lock()?;
    if let Some(segmenter) = segmenter_map.get(model) {
        return Ok(Arc::clone(segmenter));
    }

    let model = if model.starts_with("embedded://") {
        model
    } else {
        &root_dir
            .join("lindera")
            .join(format!("lindera-{}", model))
            .display()
            .to_string()
    };

    let dictionary = load_dictionary(model)?;
    let segmenter = Arc::new(Segmenter::new(Mode::Normal, dictionary, None));
    segmenter_map.insert(model.to_string(), Arc::clone(&segmenter));
    Ok(segmenter)
}
