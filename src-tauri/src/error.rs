use std::{error::Error, fmt};

use sqlx::migrate::MigrateError;
use zip::result::ZipError;

#[derive(Debug)]
pub enum AppError {
    Tauri(tauri::Error),
    Sqlx(sqlx::Error),
    SqlxMigrate(MigrateError),
    TokioJoin(tokio::task::JoinError),
    StdIo(std::io::Error),
    Zip(ZipError),
    JSON(serde_json::Error),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Tauri(e) => write!(f, "tauri::Error: {e}"),
            Self::Sqlx(e) => write!(f, "sqlx::Error: {e}"),
            Self::SqlxMigrate(e) => write!(f, "sqlx::migrate::MigrateError: {e}"),
            Self::TokioJoin(e) => write!(f, "tokio::task::JoinError: {e}"),
            Self::StdIo(e) => write!(f, "std::io::Error: {e}"),
            Self::Zip(e) => write!(f, "ZipError: {e}"),
            Self::JSON(e) => write!(f, "serde_json::Error: {e}"),
        }
    }
}

impl Error for AppError {}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        Self::Tauri(e)
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        Self::Sqlx(e)
    }
}

impl From<MigrateError> for AppError {
    fn from(e: MigrateError) -> Self {
        Self::SqlxMigrate(e)
    }
}

impl From<tokio::task::JoinError> for AppError {
    fn from(e: tokio::task::JoinError) -> Self {
        Self::TokioJoin(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::StdIo(e)
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        Self::Zip(e)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::JSON(e)
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
