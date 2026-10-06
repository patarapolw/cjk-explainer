<template>
  <div>
    <p>
      {{ isStarted ? "Downloading" : "Waiting to download" }}
      {{ $props.zipFilename || $props.filepath }} from
      {{ progress.url || $props.url }}
      <span v-if="progress.contentLength" style="float: right">
        ({{ formatFileSize(progress.downloaded) }} /
        {{ formatFileSize(progress.contentLength) }})
      </span>
    </p>
    <ProgressBar
      v-if="isStarted"
      :mode="progress.contentLength ? 'determinate' : 'indeterminate'"
      :value="percentage"
      :show-value="false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";

import ProgressBar from "primevue/progressbar";

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";

import { DownloadingProps, DownloadUrlProgress } from "../util/loading";

const props = defineProps<DownloadingProps>();

defineExpose({
  start,
});

const emit = defineEmits<{
  (event: "downloaded", result: boolean): void;
}>();

const isStarted = ref(false);

const progress = reactive<DownloadUrlProgress>({
  url: "",
  filepath: "",
  downloaded: 0,
  contentLength: 0,
});

const percentage = computed(() =>
  Math.round((100 * progress.downloaded) / progress.contentLength),
);

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

  // Downloading block
  let isDownloaded = false;

  const { url, filepath, zipOutdir, zipFilename, yomitan } = props;
  const outDir = zipOutdir || filepath;

  if (!(await exists(filepath, { baseDir: BaseDirectory.AppData }))) {
    unlisteners.value = [
      ...unlisteners.value,
      await listen<DownloadUrlProgress>(
        "download-url-progress",
        ({ payload }) => {
          Object.assign(progress, payload);
        },
      ),
    ];

    if (props.zipFilename) {
      isDownloaded = await invoke<boolean>("download_and_unzip", {
        url,
        zipFilename,
        outDir,
        isSqlite: !!yomitan,
      });
    } else {
      isDownloaded = await invoke<boolean>("download_url", {
        url,
        filepath,
      });
    }
  }

  emit("downloaded", isDownloaded);

  // parsing block
  if (yomitan) {
    await invoke("yomitan_parse_dir", {
      rootDir: outDir,
      // yomitan,
    });
    await invoke("yomitan_import", {
      dictPaths: [outDir],
    });
  }
}

onBeforeUnmount(() => {
  unlisteners.value.map((u) => u());
});
</script>

<style scoped></style>
