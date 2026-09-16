<template>
  <main class="container">
    <fieldset class="fieldset">
      <legend>LLM</legend>
      <label class="row">
        <span class="label-header">DeepSeek API key: </span>
        <InputText class="flex-grow" v-model="settingsState.deepseekApiKey" />
      </label>

      <fieldset class="row" disabled>
        <legend>Explainer prompt</legend>
        <Textarea v-model="settingsState.explainerPrompt" fluid />
      </fieldset>
    </fieldset>

    <fieldset class="fieldset">
      <legend>Supabase</legend>
      <label class="row">
        <span class="label-header">Server URL: </span>
        <InputText class="flex-grow" v-model="settingsState.supabaseURL" />
      </label>
      <label class="row">
        <span class="label-header">Publishable key: </span>
        <InputText
          class="flex-grow"
          v-model="settingsState.supabasePublishableKey"
        />
      </label>
      <label class="row">
        <span class="label-header">Username: </span>
        <InputText class="flex-grow" v-model="settingsState.supabaseUsername" />
      </label>
      <label class="row">
        <span class="label-header">Password: </span>
        <InputPassword
          class="flex-grow"
          v-model="settingsState.supabasePassword"
        />
      </label>
    </fieldset>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import InputPassword from "primevue/inputpassword";
import Textarea from "primevue/textarea";

import { onBeforeUnmount, onMounted } from "vue";
import { loadSettings, saveSettings, settingsState } from "../util/settings";

onMounted(() => {
  loadSettings();
});

onBeforeUnmount(() => {
  saveSettings();
});
</script>

<style scoped>
.container {
  padding: 1em;
  overflow: auto;
  height: 100%;
}

.row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 0.5em;
}

.row + .row {
  margin-top: 1em;
}

.fieldset + .fieldset {
  margin-top: 1em;
}

.label-header {
  width: 10em;
}

.flex-grow {
  flex-grow: 1;
}
</style>
