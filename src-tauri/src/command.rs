use tauri::{AppHandle, Emitter, Manager};
use yomitan_parser::parser::YomitanParser;

use crate::error::AppError;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
pub async fn import_yomitan_zip(app: AppHandle, path: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs
    let db_path = app.path().app_config_dir()?;

    let yomi = YomitanParser::from_zip(db_path.join(path), db_path.join("yomi_1")).await?;
    yomi.create_db(|p| {
        app.emit("yomitan-import-progress", p).unwrap();
    })
    .await?;

    Ok(())
}
