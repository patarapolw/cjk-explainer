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

import { DownloadUrlProgress } from "../util/download";

export interface IDownloadingProps {
  filepath: string;
  zipFilename?: string;
  zipOutdir?: string;
  url: string;
}

const props = defineProps<IDownloadingProps>();
defineExpose({
  start,
});

const emit = defineEmits<{
  (event: "done", result: boolean): void;
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
    if (n < 100) break;
    n /= 1024;
  }
  return `${n.toPrecision(3)} ${units[i - 1]}`;
}

const unlistenFn = ref<UnlistenFn>();

async function start() {
  isStarted.value = true;
  let result = false;

  if (await exists(props.filepath, { baseDir: BaseDirectory.AppData })) {
    emit("done", false);
    return false;
  }

  unlistenFn.value = await listen<DownloadUrlProgress>(
    "download-url-progress",
    ({ payload }) => {
      Object.assign(progress, payload);
    },
  );

  try {
    if (props.zipFilename) {
      result = await invoke<boolean>("download_and_unzip", {
        url: props.url,
        zipFilename: props.zipFilename,
        outDir: props.zipOutdir || props.filepath,
      });
      emit("done", result);
    } else {
      result = await invoke<boolean>("download_url", {
        url: props.url,
        filepath: props.filepath,
      });
      emit("done", result);
    }
  } finally {
    unlistenFn.value?.();
  }

  return result;
}

onBeforeUnmount(() => {
  unlistenFn.value?.();
});
</script>

<style scoped></style>
