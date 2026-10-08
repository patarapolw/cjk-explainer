<template>
  <div>
    <p>
      {{ message }}
      <span v-if="progressMessage" style="float: right">
        ({{ progressMessage }})
      </span>
    </p>
    <ProgressBar
      v-if="isStarted"
      :mode="progressMessage ? 'determinate' : 'indeterminate'"
      :value="percentage"
      :show-value="false"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

import ProgressBar from "primevue/progressbar";

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import {
  DownloadingProps,
  DownloadUrlProgress,
  UnzipProgress,
} from "../util/loading";
import {
  YomitanImportProgress,
  YomitanSearchInitProgress,
} from "../util/dicts";

const props = defineProps<DownloadingProps>();

defineExpose({
  start,
});

const isStarted = ref(false);
const message = ref(`Waiting to download ${props.filename} from ${props.url}`);
const progressMessage = ref("");
const percentage = ref(0);

function formatFileSize(n: number) {
  const units = ["bytes", "KB", "MB"];
  let i = 0;

  while (i++ < units.length) {
    if (n < 1024) break;
    n /= 1024;
  }
  return `${n.toPrecision(3)} ${units[i - 1]}`;
}

const unlisteners = ref<UnlistenFn[]>([]);

async function start() {
  isStarted.value = true;

  // **Downloading block
  let isDownloaded = false;

  const { url, filename, outDir, yomitan } = props;

  unlisteners.value = [
    ...unlisteners.value,
    await listen<DownloadUrlProgress>(
      "download-url-progress",
      ({ payload }) => {
        message.value = `Downloading ${payload.filepath} from ${payload.url}`;
        progressMessage.value = `${formatFileSize(payload.downloaded)} / ${formatFileSize(payload.contentLength)}`;
        percentage.value = Math.round(
          (100 * payload.downloaded) / payload.contentLength,
        );
      },
    ),
    await listen<UnzipProgress>("unzip-progress", ({ payload }) => {
      message.value = `Unzipping ${payload.filename} to ${payload.outDir}/`;
      progressMessage.value = "";
      percentage.value = 0;
    }),
  ];

  if (props.outDir) {
    isDownloaded = await invoke<boolean>("download_and_unzip", {
      url,
      filename,
      outDir,
      isSqlite: !!yomitan,
    });
  } else {
    isDownloaded = await invoke<boolean>("download_url", {
      url,
      filename,
    });
  }

  // **Parsing block
  if (yomitan) {
    unlisteners.value = [
      ...unlisteners.value,
      await listen<YomitanImportProgress>(
        "yomitan-import-progress",
        ({ payload }) => {
          message.value = `Importing ${payload.bank} from ${outDir}`;
          progressMessage.value = `${payload.current.toLocaleString()} / ${payload.total.toLocaleString()}`;
          percentage.value = Math.round(
            (100 * payload.current) / payload.total,
          );
        },
      ),
      await listen<YomitanSearchInitProgress>(
        "yomitan-init-progress",
        ({ payload }) => {
          message.value = `Importing ${payload.dict} into search.db`;
          progressMessage.value = `${payload.current.toLocaleString()} / ${payload.total.toLocaleString()}`;
          percentage.value = Math.round(
            (100 * payload.current) / payload.total,
          );
        },
      ),
    ];

    await invoke("yomitan_parse_dir", {
      rootDir: outDir,
      // yomitan,
    });
    await invoke("yomitan_import", {
      dictPaths: [outDir],
    });
  }

  unlisteners.value.map((u) => u());
  unlisteners.value = [];
}

onBeforeUnmount(() => {
  unlisteners.value.map((u) => u());
});
</script>

<style scoped></style>
