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
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import { onBeforeUnmount, ref } from "vue";

import ProgressBar from "primevue/progressbar";

import { YomitanSearchInitProgress } from "../util/dicts";
import { YomitanImportProps } from "../util/loading";

const { dictPaths } = defineProps<YomitanImportProps>();

defineExpose({
  start,
});

const isStarted = ref(false);
const message = ref("Importing to search.db");
const progressMessage = ref("");
const percentage = ref(0);

const unlisteners = ref<UnlistenFn[]>([]);

async function start() {
  isStarted.value = true;

  unlisteners.value = [
    ...unlisteners.value,
    await listen<YomitanSearchInitProgress>(
      "yomitan-init-progress",
      ({ payload }) => {
        message.value = `Importing ${payload.dict} into search.db`;
        progressMessage.value = `${payload.current.toLocaleString()} / ${payload.total.toLocaleString()}`;
        percentage.value = Math.round((100 * payload.current) / payload.total);
      },
    ),
  ];

  await invoke("yomitan_import", {
    dictPaths,
  });

  unlisteners.value.map((u) => u());
  unlisteners.value = [];
}

onBeforeUnmount(() => {
  unlisteners.value.map((u) => u());
});
</script>

<style scoped></style>
