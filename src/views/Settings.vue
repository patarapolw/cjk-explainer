<template>
  <main class="container">
    <fieldset class="fieldset">
      <legend>LLM</legend>
      <label class="row">
        <span class="label-header">DeepSeek API key: </span>
        <InputText
          class="flex-grow"
          v-model="settingsState.state.deepseekApiKey"
          :placeholder="settingsState.default.deepseekApiKey"
        />
      </label>

      <fieldset class="row" disabled>
        <legend>Explainer prompt</legend>
        <Textarea
          v-model="settingsState.state.explainerPrompt"
          :placeholder="settingsState.default.explainerPrompt"
          fluid
          auto-resize
        />
      </fieldset>
    </fieldset>

    <fieldset class="fieldset">
      <legend>Supabase</legend>
      <label class="row">
        <span class="label-header">Server URL: </span>
        <InputText
          class="flex-grow"
          v-model="settingsState.state.supabaseURL"
          :placeholder="settingsState.default.supabaseURL"
        />
      </label>
      <label class="row">
        <span class="label-header">Publishable key: </span>
        <InputText
          class="flex-grow"
          v-model="settingsState.state.supabasePublishableKey"
          :placeholder="settingsState.default.supabasePublishableKey"
        />
      </label>
      <label class="row">
        <span class="label-header">Username: </span>
        <InputText
          class="flex-grow"
          v-model="settingsState.state.supabaseUsername"
          :placeholder="settingsState.default.supabaseUsername"
        />
      </label>
      <label class="row">
        <span class="label-header">Password: </span>
        <InputPassword
          class="flex-grow"
          v-model="settingsState.state.supabasePassword"
          :placeholder="settingsState.default.supabasePassword"
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
import { settingsState } from "../util/settings";

onMounted(() => {
  settingsState.load();
});

onBeforeUnmount(() => {
  settingsState.save();
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
