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

  const zipFilename = `lindera-${model}-${version}.zip`;
  const url = `https://github.com/lindera/lindera/releases/download/v${version}/${zipFilename}`;
  callback({
    url,
    filepath: zipFilename,
    contentLength: 0,
    downloaded: 0,
  });

  const unlisten = await listen<DownloadUrlProgress>(
    "download-url-progress",
    ({ payload }) => callback(payload),
  );

  await invoke("download_and_unzip", {
    url,
    zipFilename,
    outDir: "lindera",
  }).finally(unlisten);
}
