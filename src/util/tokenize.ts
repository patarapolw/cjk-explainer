import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";

export interface DownloadUrlProgress {
  url: string;
  filepath: string;
  contentLength: number;
  downloaded: number;
}

export async function fetchLinderaModel(
  { model, version = "6.2.0" }: { model: string; version?: string },
  callback: (p: DownloadUrlProgress) => void,
) {
  const extractedFolderName = `lindera/lindera-${model}`;
  if (await exists(extractedFolderName, { baseDir: BaseDirectory.AppData })) {
    return;
  }

  const downloadZipFilename = `lindera-${model}-${version}.zip`;
  if (
    !(await exists(downloadZipFilename, { baseDir: BaseDirectory.AppData }))
  ) {
    const url = `https://github.com/lindera/lindera/releases/download/v${version}/${downloadZipFilename}`;
    callback({
      url,
      filepath: downloadZipFilename,
      contentLength: 0,
      downloaded: 0,
    });

    const unlisten = await listen<DownloadUrlProgress>(
      "download-url-progress",
      ({ payload }) => callback(payload),
    );

    await invoke("download_url", {
      url,
      filepath: downloadZipFilename,
    }).finally(unlisten);
  }

  await invoke("unzip", { filepath: downloadZipFilename, outDir: "lindera" });
}
