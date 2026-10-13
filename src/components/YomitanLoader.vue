<template>
  <div>
    <p v-for="(msg, i) in oldMessages" :key="i">{{ msg }}</p>
    <p>
      {{ message }}
      <span v-if="progressMessage" style="float: right">
        ({{ progressMessage }})
      </span>
    </p>
    <ProgressBar
      v-if="isStarted"
      :mode="percentage ? 'determinate' : 'indeterminate'"
      :value="percentage"
      :show-value="false"
    />
  </div>
</template>

<script setup lang="ts">
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import { onBeforeUnmount, ref, watch } from "vue";

import ProgressBar from "primevue/progressbar";

import { YomitanSearchInitProgress } from "../util/dicts";
import { YomitanImportProps } from "../util/loading";

const { dictPaths, lang } = defineProps<YomitanImportProps>();

defineExpose({
  start,
});

const isStarted = ref(false);

const oldMessages = ref<string[]>([]);
const message = ref(
  `Waiting to import ${lang ? `(${lang})` : ""} ${dictPaths.join(", ")} into search.db`,
);
const currentDict = ref("");

const progressMessage = ref("");
const percentage = ref(0);

const unlisteners = ref<UnlistenFn[]>([]);

let startTime: Date;
watch(percentage, () => {
  startTime = startTime || new Date();
  const now = new Date();
  const elapsedMinutes = (+now - +startTime) / (1000 * 60);
  const remaining = elapsedMinutes * (100 / percentage.value) - elapsedMinutes;

  progressMessage.value = `${remaining >= 1 ? remaining.toPrecision(2) : "< 1"} min left`;
});

async function start() {
  isStarted.value = true;
  startTime = new Date();

  unlisteners.value = [
    ...unlisteners.value,
    await listen<YomitanSearchInitProgress>(
      "yomitan-init-progress",
      ({ payload }) => {
        if (currentDict.value && payload.dict !== currentDict.value) {
          oldMessages.value = [
            ...oldMessages.value,
            `Imported ${currentDict.value}`,
          ];
          currentDict.value = payload.dict;
        }

        message.value = `Importing ${lang ? `(${lang})` : ""} ${payload.dict} into search.db`;
        percentage.value = Math.round((100 * payload.current) / payload.total);
      },
    ),
  ];

  await invoke("yomitan_import", {
    dictPaths,
    lang,
  });

  unlisteners.value.map((u) => u());
  unlisteners.value = [];
}

onBeforeUnmount(() => {
  unlisteners.value.map((u) => u());
});
</script>

<style scoped></style>
