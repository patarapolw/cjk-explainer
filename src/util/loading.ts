import { ref } from "vue";

export interface DownloadingProps {
  filepath: string;
  zipFilename?: string;
  zipOutdir?: string;
  url: string;
  yomitan?: {}; // TODO: yomitan user metadata
}

export interface DownloadUrlProgress {
  url: string;
  filepath: string;
  contentLength: number;
  downloaded: number;
}

export const toBeLoaded = ref<DownloadingProps[]>([]);
