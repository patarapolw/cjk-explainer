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

const yomitanBaseDir = BaseDirectory.AppConfig;

interface IGhSource {
  dictName: string;
  regex: RegExp;
  lang?: string;
}

export async function standardDicts(): Promise<DownloadingProps[]> {
  const out: DownloadingProps[] = [];

  const ghSources: Record<string, IGhSource[]> = {
    "MarvNC/pixiv-yomitan": [
      {
        dictName: "Pixiv",
        regex: /^Pixiv_.+\.zip$/,
      },
    ],
    "MarvNC/wikipedia-yomitan": [
      {
        dictName: "ja.Wikipedia",
        regex: /^ja\.Wikipedia\..+\.zip$/,
        lang: "ja-JP",
      },
      {
        dictName: "zh.Wikipedia",
        regex: /^zh\.Wikipedia\..+\.zip$/,
        lang: "zh-CN",
      },
      {
        dictName: "ko.Wikipedia",
        regex: /^ko\.Wikipedia\..+\.zip$/,
        lang: "ko-KR",
      },
    ],
    "MarvNC/cc-cedict-yomitan": [
      {
        dictName: "CC-CEDICT",
        regex: /^CC-CEDICT\.zip$/,
        lang: "zh-CN",
      },
    ],
    "Lyroxide/yomitan-ko-dic": [
      {
        dictName: "KO-EN.KRDICT",
        regex: /^KO-EN\.KRDICT\.zip$/,
        lang: "ko-KR",
      },
    ],
  };

  for (const [user_repo, vs] of Object.entries(ghSources)) {
    let assets: (IGhSource & { props: DownloadingProps })[] = vs.map(
      ({ dictName, regex, lang }) => ({
        dictName,
        regex,
        lang,
        props: {
          filename: `${dictName}.zip`,
          outDir: `yomitan/${dictName}`,
          url: "",
          yomitan: {
            dictName,
            lang,
          },
        },
      }),
    );

    if (
      (
        await Promise.all(
          assets.map((a) =>
            exists(a.props.outDir!, { baseDir: yomitanBaseDir }),
          ),
        )
      ).some((ex) => !ex)
    ) {
      const {
        assets: resAssets,
      }: {
        assets: { name: string; browser_download_url: string }[];
      } = await fetch(
        /**
         * @see https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#get-the-latest-release
         */
        `https://api.github.com/repos/${user_repo}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "cjk-explainer",
          },
        },
      ).then((r) => r.json());

      assets = assets.map((a) => {
        a.props.url =
          resAssets.find((res) => a.regex.test(res.name))
            ?.browser_download_url || "";
        return a;
      });
    }

    out.push(...assets.map((a) => a.props));
  }

  for (let lang of ["ja-JP", "ko-KR", "zh-CN"]) {
    const L1 = lang.split("-")[0];
    const L2 = "en";
    const dictName = `wty-${L1}-${L2}`;
    const filename = `${dictName}.zip`;

    out.push({
      filename,
      outDir: `yomitan/${dictName}`,
      url: `https://huggingface.co/datasets/daxida/wty-release/resolve/main/latest/dict/${L1}/${L2}/${filename}`,
      yomitan: {
        dictName,
        lang,
      },
    });
  }

  for (const d of out) {
    if (
      await exists(`${d.outDir}/term_bank_1.json`, {
        baseDir: yomitanBaseDir,
      })
    ) {
      d.url = "";
      // try to overwrite ${d.outDir}/content.db anyway if /term_bank_1.json still exists
    } else if (
      await exists(`${d.outDir}/content.db`, {
        baseDir: yomitanBaseDir,
      })
    ) {
      d.filename = "";
    }

    const STATS_JSON = "stats.json";
    if (
      await exists(`${d.outDir}/${STATS_JSON}`, {
        baseDir: yomitanBaseDir,
      })
    ) {
      d.filename = "";
    }
  }

  return out;
}
