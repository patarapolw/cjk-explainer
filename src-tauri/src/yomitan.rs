use std::{collections::HashMap, path::PathBuf};

use futures::future::join_all;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::{
    fs::{File, read_dir, read_to_string, remove_file},
    io::AsyncWriteExt,
};
use yomitan_parser::{
    error::YomitanError,
    parser::{YomitanImportProgress, YomitanParser},
    search::YomitanSearch,
    tokenize::Lang,
};

use crate::{AppState, error::AppError};

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
pub async fn yomitan_make_ndjson(app: tauri::AppHandle, root_dir: &str) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs#91
    // plugin says app_config_dir()
    let app_config_dir = app.path().app_config_dir()?;
    let root_dir = &app_config_dir.join(root_dir);

    let mut json_files: HashMap<String, Vec<(u32, PathBuf)>> = HashMap::new();

    let mut entries = read_dir(root_dir).await?;
    while let Some(entry) = entries.next_entry().await? {
        if !entry.file_type().await?.is_file() {
            continue;
        }

        let path = entry.path();

        if !path
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
        {
            continue;
        }

        if let Some(filestem) = path.file_stem().and_then(|s| s.to_str()) {
            if let Some((bank_name, id_str)) = filestem.rsplit_once("_")
                && let Ok(idx) = id_str.parse::<u32>()
            {
                match json_files.get_mut(bank_name) {
                    Some(rs) => {
                        rs.push((idx, path));
                    }
                    _ => {
                        json_files.insert(bank_name.to_string(), vec![(idx, path)]);
                    }
                };
            }
        }
    }

    let mut parsed_files: Vec<&PathBuf> = vec![];

    for (bank_name, rs) in json_files.iter_mut() {
        rs.sort_by_key(|r| r.0);

        let total = rs.len();

        let mut f = File::create(root_dir.join(format!("{bank_name}.ndjson"))).await?;

        for (idx, path) in rs {
            app.emit(
                "yomitan-import-progress",
                YomitanImportProgress {
                    bank: bank_name.to_string(),
                    current: *idx,
                    total,
                },
            )
            .unwrap();

            let json_str = read_to_string(&mut *path).await?;
            let rows: Vec<serde_json::Value> = serde_json::from_str(&json_str)?;
            for r in rows {
                let r_str = serde_json::to_string(&r)?;
                f.write_all(r_str.as_bytes()).await?;
                f.write_all(b"\n").await?;
            }
            parsed_files.push(path);
        }
    }

    join_all(parsed_files.iter().map(|f| remove_file(f))).await;

    Ok(())
}

#[tauri::command]
pub async fn yomitan_import(
    app: AppHandle,
    dict_paths: Vec<&str>,
    lang: Option<&str>,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    // adapted from https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/sql/src/wrapper.rs#91
    // plugin says app_config_dir()
    let app_config_dir = app.path().app_config_dir()?;

    let yomi = YomitanSearch::new(app_config_dir.join("search.db"), dict_paths.clone()).await?;

    let lang = match lang {
        Some(x) => {
            Some(Lang::from(x).ok_or(YomitanError::UnsupportedLanguageError(x.to_string()))?)
        }
        None => None,
    };

    for dict in dict_paths {
        yomi.import(dict, lang, &state.tokenizer_mapper, |p| {
            app.emit("yomitan-init-progress", p).unwrap();
        })
        .await?;
    }

    Ok(())
}
