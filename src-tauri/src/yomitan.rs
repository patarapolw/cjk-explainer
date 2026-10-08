use tauri::{AppHandle, Emitter, Manager};
use yomitan_parser::{
    error::YomitanError,
    parser::YomitanParser,
    search::YomitanSearch,
    tokenize::{Lang, TokenizerMapper},
};

use crate::error::AppError;

#[tauri::command]
pub async fn yomitan_parse_zip(
    app: AppHandle,
    zip_path: &str,
    root_dir: Option<&str>,
) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs#91
    // plugin says app_config_dir()
    let app_config_dir = app.path().app_config_dir()?;
    let root_dir = match root_dir {
        Some(d) => d.to_string(),
        None => {
            if let Some((stem, _)) = zip_path.rsplit_once('.') {
                stem.to_string()
            } else {
                format!("{}_data", zip_path)
            }
        }
    };

    let yomi =
        YomitanParser::from_zip(app_config_dir.join(zip_path), app_config_dir.join(root_dir))
            .await?;

    yomi.create_db(|p| {
        app.emit("yomitan-import-progress", p).unwrap();
    })
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn yomitan_parse_dir(app: AppHandle, root_dir: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs#91
    // plugin says app_config_dir()
    let app_config_dir = app.path().app_config_dir()?;

    let yomi = YomitanParser::from_dir(app_config_dir.join(root_dir));
    yomi.create_db(|p| {
        app.emit("yomitan-import-progress", p).unwrap();
    })
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn yomitan_import(
    app: AppHandle,
    dict_paths: Vec<&str>,
    lang: Option<&str>,
) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs#91
    // plugin says app_config_dir()
    let app_config_dir = app.path().app_config_dir()?;

    let yomi = YomitanSearch::new(app_config_dir.join("yomitan.db"), dict_paths.clone()).await?;

    let lang = match lang {
        Some(x) => {
            Some(Lang::from(x).ok_or(YomitanError::UnsupportedLanguageError(x.to_string()))?)
        }
        None => None,
    };

    let app_data_dir = app.path().app_data_dir()?;
    let tok = TokenizerMapper::new(app_data_dir.join("lindera"));

    for dict in dict_paths {
        yomi.import(dict, lang, &tok, |p| {
            app.emit("yomitan-init-progress", p).unwrap();
        })
        .await?;
    }

    Ok(())
}
