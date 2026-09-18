use sqlx::{migrate::MigrateDatabase, Sqlite, SqlitePool};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
pub async fn create_sqlite(app: AppHandle, path: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs
    // which doesn't perform path sanitization
    let db_url = format!(
        "sqlite:{}",
        app.path()
            .resolve(format!("{path}.db"), tauri::path::BaseDirectory::AppConfig)?
            .to_str()
            .ok_or(AppError::InvalidPath)?
    );

    if !Sqlite::database_exists(&db_url).await? {
        println!("Creating database {}", &db_url);
        Sqlite::create_database(&db_url).await?;
    }

    let db = SqlitePool::connect(&db_url).await?;

    // TODO:
    sqlx::query("sql").execute(&db).await?;

    Ok(())
}
