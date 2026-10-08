import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

import { DownloadingProps } from "./loading";

export interface YomitanImportProgress {
  bank: string;
  current: number;
  total: number;
}

export interface YomitanSearchInitProgress {
  dict: string;
  current: number;
  total: number;
}

/**
 * @see https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#get-the-latest-release
 */
export async function ghLatestReleaseURL(user_repo: string, assetName: RegExp) {
  const releaseData: {
    assets: { name: string; browser_download_url: string }[];
  } = await fetch(`https://api.github.com/repos/${user_repo}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cjk-explainer",
    },
  }).then((r) => r.json());

  const a = releaseData.assets.find((a) => assetName.test(a.name));
  if (!a) return;
  return a.browser_download_url;
}

export async function standardDicts(): Promise<DownloadingProps[]> {
  const out: DownloadingProps[] = [];

  const outDir = "PixivLight";
  const d: DownloadingProps = {
    filename: `${outDir}.zip`,
    outDir,
    url: "",
    yomitan: {},
  };
  out.push(d);
  if (!(await exists(outDir, { baseDir: BaseDirectory.AppConfig }))) {
    // TODO: check for updates, rather than existence
    const url = await ghLatestReleaseURL(
      "MarvNC/pixiv-yomitan",
      /^PixivLight_.+\.zip$/,
    );
    if (url) {
      d.url = url;
    }
  } else if (
    await exists(`${outDir}/term_bank_1.json`, {
      baseDir: BaseDirectory.AppConfig,
    })
  ) {
  } else if (
    await exists(`${outDir}/.imported`, { baseDir: BaseDirectory.AppConfig })
  ) {
    out.pop();
  } else {
    d.filename = "";
  }

  return out;
}
