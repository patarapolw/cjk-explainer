use std::{error::Error, fmt, sync::PoisonError};

use lindera::error::LinderaError;
use yomitan_parser::error::YomitanError;

#[derive(Debug)]
pub enum AppError {
    Tauri(tauri::Error),
    TauriReqwest(tauri_plugin_http::reqwest::Error),
    Yomitan(YomitanError),
    Lindera(LinderaError),
    MutexPoisoned(String),
    IOError(std::io::Error),
    Error(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Tauri(e) => write!(f, "tauri::Error: {e}"),
            Self::Yomitan(e) => write!(f, "YomitanError: {e}"),
            Self::TauriReqwest(e) => write!(f, "TauriReqwest: {e}"),
            Self::Lindera(e) => write!(f, "LinderaError: {e}"),
            Self::MutexPoisoned(e) => write!(f, "MutexPoisoned: {e}"),
            Self::IOError(e) => write!(f, "IOError: {e}"),
            Self::Error(e) => write!(f, "Error: {e}"),
        }
    }
}

impl Error for AppError {}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        Self::Tauri(e)
    }
}

impl From<tauri_plugin_http::reqwest::Error> for AppError {
    fn from(e: tauri_plugin_http::reqwest::Error) -> Self {
        Self::TauriReqwest(e)
    }
}

impl From<YomitanError> for AppError {
    fn from(e: YomitanError) -> Self {
        Self::Yomitan(e)
    }
}

impl From<LinderaError> for AppError {
    fn from(e: LinderaError) -> Self {
        Self::Lindera(e)
    }
}

impl<T> From<PoisonError<T>> for AppError {
    fn from(e: PoisonError<T>) -> Self {
        Self::MutexPoisoned(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::IOError(e)
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
