use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_http::reqwest;
use tokio::{fs::remove_file, io::AsyncWriteExt};

use serde::Serialize;
use zip::ZipArchive;

use crate::error::AppError;

#[tauri::command]
pub async fn download_url(app: AppHandle, url: &str, filename: &str) -> Result<bool, AppError> {
    let app_data_dir = app.path().app_data_dir()?;

    download_url_local(url, &app_data_dir, filename, |progress| {
        app.emit("download-url-progress", progress).unwrap();
    })
    .await
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UnzipProgress {
    filename: String,
    out_dir: String,
}

#[tauri::command]
pub async fn unzip(app: AppHandle, filename: &str, out_dir: &str) -> Result<(), AppError> {
    let app_data_dir = app.path().app_data_dir()?;
    let filepath = app_data_dir.join(filename);
    let out_path = app_data_dir.join(out_dir);

    app.emit(
        "unzip-progress",
        UnzipProgress {
            filename: filename.to_string(),
            out_dir: out_dir.to_string(),
        },
    )?;

    tokio::task::spawn_blocking(move || unzip_sync(filepath, out_path)).await??;

    Ok(())
}

#[tauri::command]
pub async fn download_and_unzip(
    app: AppHandle,
    url: &str,
    filename: &str,
    out_dir: &str,
    is_sqlite: Option<bool>,
) -> Result<bool, AppError> {
    let out_path = is_sqlite
        .and_then(|b| {
            if b {
                Some(app.path().app_config_dir())
            } else {
                None
            }
        })
        .unwrap_or_else(|| app.path().app_data_dir())?
        .join(out_dir);

    let app_cache_dir = app.path().app_cache_dir()?;
    let zip_filepath = app_cache_dir.join(filename);

    if !zip_filepath.exists() {
        let r = download_url_local(url, &app_cache_dir, filename, |progress| {
            app.emit("download-url-progress", progress).unwrap();
        })
        .await?;
        if !r {
            return Ok(false);
        }
    }

    app.emit(
        "unzip-progress",
        UnzipProgress {
            filename: filename.to_string(),
            out_dir: out_dir.to_string(),
        },
    )?;

    tokio::task::spawn_blocking(move || unzip_sync(zip_filepath, out_path)).await??;

    Ok(true)
}

fn unzip_sync(filepath: PathBuf, out_dir: PathBuf) -> zip::result::ZipResult<()> {
    let file = std::fs::File::open(&filepath)?; // Use sync version in thread
    let mut archive = ZipArchive::new(file)?;
    archive.extract(&out_dir)?;

    println!("Unzipped {:?} to {:?}", &filepath, &out_dir);
    Ok(())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    url: String,
    filepath: String,
    content_length: u64,
    downloaded: u64,
}

async fn download_url_local<Callback>(
    url: &str,
    out_dir: &PathBuf,
    filename: &str,
    callback: Callback,
) -> Result<bool, AppError>
where
    Callback: Fn(DownloadProgress),
{
    let client = reqwest::Client::new();
    let file_pf = out_dir.join(filename);

    let temp_pf = out_dir.join(format!("{}.dl-tmp", filename));
    let temp_path = temp_pf.as_path();
    // Check existing partial download size
    let existing_size = tokio::fs::metadata(temp_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let mut request = client.get(url);
    // Request only the remaining bytes
    if existing_size > 0 {
        request = request.header("Range", format!("bytes={}-", existing_size));
    }

    // Making the asynchronous GET request
    let mut response = request.send().await?;

    // Check if the request was successful
    if response.status().is_success() {
        let content_length = response.content_length().unwrap_or(0);
        let mut file = if existing_size > 0 {
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(temp_path)
                .await?
        } else {
            tokio::fs::File::create(&file_pf).await?
        };

        // Downloading the file in chunks
        let mut downloaded: u64 = 0;
        while let Some(chunk) = response.chunk().await? {
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            callback(DownloadProgress {
                url: url.to_owned(),
                filepath: filename.to_owned(),
                content_length,
                downloaded,
            });
        }

        // Verify download completeness
        if content_length > 0 && downloaded < content_length {
            // Delete incomplete file
            drop(file); // ensure file handle is released before deleting
            remove_file(&file_pf).await?;
            return Err(AppError::Error(format!(
                "Incomplete download: expected {} bytes, got {}",
                content_length, downloaded
            )));
        }

        println!(
            "File downloaded {} MB to {:?}",
            content_length >> 20,
            &file_pf
        );
    } else {
        eprintln!("Failed to download file: {:?}", response.status());
    }

    Ok(true)
}
