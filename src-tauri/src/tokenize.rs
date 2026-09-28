use lindera::{
    dictionary::{Dictionary, load_dictionary},
    mode::Mode,
    segmenter::Segmenter,
};
use lindera_analysis::tokenizer::Tokenizer;
use tauri::State;

use crate::{AppState, error::AppError};

#[tauri::command]
pub async fn segment(
    model: &str,
    text: &str,
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>)>, AppError> {
    let segmenter = get_segmenter(model, state.clone())?;

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
    let mut tokenizer_map = state
        .tokenizer
        .lock()
        .expect("tokenizer map can't be retrieved");
    let tokenizer = match tokenizer_map.get(model) {
        Some(t) => t.clone(),
        None => {
            let s = get_segmenter(model, state.clone())?;
            let t = Tokenizer::new(s);
            tokenizer_map.insert(model.to_string(), t.clone());
            t
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

fn get_dictionary(model: &str, state: State<'_, AppState>) -> Result<Dictionary, AppError> {
    let mut dictionary_map = state
        .dictionary
        .lock()
        .expect("dictionary map can't be retrieved");

    Ok(match dictionary_map.get(model) {
        Some(d) => d.clone(),
        None => {
            let d = load_dictionary(model)?;
            dictionary_map.insert(model.to_string(), d.clone());
            d
        }
    })
}

fn get_segmenter(model: &str, state: State<'_, AppState>) -> Result<Segmenter, AppError> {
    let mut segmenter_map = state
        .segmenter
        .lock()
        .expect("segment map can't be retrieved");
    Ok(match segmenter_map.get(model) {
        Some(s) => s.clone(),
        None => {
            let s = Segmenter::new(Mode::Normal, get_dictionary(model, state.clone())?, None);
            segmenter_map.insert(model.to_string(), s.clone());
            s
        }
    })
}
