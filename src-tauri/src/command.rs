use tauri::{AppHandle, Emitter, Manager};
use yomitan_parser::{parser::YomitanParser, search::YomitanSearch};

use crate::error::AppError;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
pub async fn import_yomitan_zip(app: AppHandle, path: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs
    let app_config_dir = app.path().app_config_dir()?;

    let yomi =
        YomitanParser::from_zip(app_config_dir.join(path), app_config_dir.join("yomi_1")).await?;
    yomi.create_db(|p| {
        app.emit("yomitan-import-progress", p).unwrap();
    })
    .await?;

    let _ = YomitanSearch::init(
        app_config_dir.join("yomitan.db"),
        vec!["yomi_1"],
        "ja-JP",
        |p| {
            app.emit("yomitan-init-progress", p).unwrap();
        },
    )
    .await?;

    Ok(())
}
