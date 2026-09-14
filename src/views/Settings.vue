<template>
  <main class="container">
    <label class="row">
      <span>DeepSeek API key: </span>
      <InputText class="flex-grow" v-model="apiKey" />
    </label>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";

import { onBeforeUnmount, onMounted } from "vue";
import { apiKey, LSKEY_apiKey } from "../util/llm";

onMounted(() => {
  const k = localStorage.getItem(LSKEY_apiKey);
  if (typeof k === "string") {
    apiKey.value = k;
  }
});

onBeforeUnmount(() => {
  localStorage.setItem(LSKEY_apiKey, apiKey.value);
});
</script>

<style scoped>
.container {
  padding: 1em;
}

.row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 0.5em;
}

.flex-grow {
  flex-grow: 1;
}
</style>
