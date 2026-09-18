use std::time::Duration;

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteSynchronous},
    SqlitePool,
};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
pub async fn create_sqlite(app: AppHandle, path: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs
    let db_path = app
        .path()
        .resolve(path, tauri::path::BaseDirectory::AppConfig)?;

    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5))
        .foreign_keys(true)
        .pragma("cache_size", "-64000") // approximately 64 MiB
        .pragma("temp_store", "MEMORY")
        .pragma("mmap_size", "268435456"); // 256 MiB

    let db = SqlitePool::connect_with(options).await?;

    sqlx::query("CREATE TABLE IF NOT EXISTS x (a, b, PRIMARY KEY (a))")
        .execute(&db)
        .await?;

    let mut tx = db.begin().await?;

    let values = [[1, 2], [3, 4]];

    for [a, b] in values {
        // SQLx maintains a prepared-statement cache per database connection.
        // Repeatedly executing the same SQL on the same pooled connection can reuse the prepared statement automatically.
        sqlx::query(
            "
            INSERT INTO x (a, b) VALUES (?, ?)
            ON CONFLICT (a)
            DO UPDATE SET b = excluded.b + 1
            ",
        )
        .bind(a)
        .bind(b)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    db.close().await;

    Ok(())
}
