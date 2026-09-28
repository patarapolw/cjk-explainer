use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_http::reqwest;
use tokio::{fs::remove_file, io::AsyncWriteExt};

use serde::Serialize;

use crate::error::AppError;

#[tauri::command]
pub async fn download_url(app: AppHandle, url: &str, filepath: &str) -> Result<bool, AppError> {
    let app_data_dir = app.path().app_data_dir()?;
    println!("{:?}", app_data_dir);

    download_url_local(url, &app_data_dir, filepath, |progress| {
        app.emit("download-url-progress", progress).unwrap();
    })
    .await
}

#[derive(Serialize, Clone)]
struct DownloadProgress {
    url: String,
    filepath: String,
    content_length: u64,
    downloaded: u64,
}

async fn download_url_local<Callback>(
    url: &str,
    data_dir: &PathBuf,
    filepath: &str,
    callback: Callback,
) -> Result<bool, AppError>
where
    Callback: Fn(DownloadProgress),
{
    let client = reqwest::Client::new();
    let file_pf = data_dir.join(filepath);

    let temp_pf = data_dir.join(format!("{}.dl-tmp", filepath));
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
                filepath: filepath.to_owned(),
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

        println!("File downloaded successfully to {:?}", &file_pf);
    } else {
        eprintln!("Failed to download file: {:?}", response.status());
    }

    Ok(true)
}
