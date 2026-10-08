import { ref } from "vue";

export interface DownloadingProps {
  filename: string;
  outDir?: string;
  url: string;
  yomitan?: {}; // TODO: yomitan user metadata
}

export interface YomitanImportProps {
  dictPaths: string[];
}

export interface DownloadUrlProgress {
  url: string;
  filepath: string;
  contentLength: number;
  downloaded: number;
}

export interface UnzipProgress {
  filename: string;
  outDir: string;
}

export const toBeLoaded = ref<(DownloadingProps | YomitanImportProps)[]>([]);
