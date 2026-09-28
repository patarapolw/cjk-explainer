use lindera::{dictionary::load_dictionary, mode::Mode, segmenter::Segmenter};
use lindera_analysis::tokenizer::Tokenizer;
use std::sync::Arc;
use tauri::State;

use crate::{AppState, error::AppError};

#[tauri::command]
pub async fn segment(
    model: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let segmenter = get_segmenter(model, &state)?;

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
    model: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let tokenizer = {
        let mut tokenizer_map = state.tokenizer.lock()?;
        match tokenizer_map.get(model) {
            Some(t) => Arc::clone(t),
            None => {
                let segmenter = get_segmenter(model, &state)?;
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

fn get_segmenter(model: &str, state: &AppState) -> Result<Arc<Segmenter>, AppError> {
    let mut segmenter_map = state.segmenter.lock()?;
    if let Some(segmenter) = segmenter_map.get(model) {
        return Ok(Arc::clone(segmenter));
    }

    let dictionary = load_dictionary(model)?;
    let segmenter = Arc::new(Segmenter::new(Mode::Normal, dictionary, None));
    segmenter_map.insert(model.to_string(), Arc::clone(&segmenter));
    Ok(segmenter)
}
