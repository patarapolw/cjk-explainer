use std::{error::Error, fmt};

use yomitan_parser::error::YomitanError;

#[derive(Debug)]
pub enum AppError {
    Tauri(tauri::Error),
    Yomitan(YomitanError),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Tauri(e) => write!(f, "tauri::Error: {e}"),
            Self::Yomitan(e) => write!(f, "YomitanError: {e}"),
        }
    }
}

impl Error for AppError {}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        Self::Tauri(e)
    }
}

impl From<YomitanError> for AppError {
    fn from(e: YomitanError) -> Self {
        Self::Yomitan(e)
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
