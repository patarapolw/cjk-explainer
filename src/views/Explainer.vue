<template>
  <main class="container">
    <div class="row">
      <InputText class="flex-grow-1" v-model="currentText" />
    </div>
    <div class="row">
      <div class="flex-grow-1"></div>
      <label class="row" @click.prevent="toggleClipboardMonitor()">
        <span style="margin-right: -0.5em">Clipboard</span>
        <ToggleSwitch :model-value="clipboardInterval !== 0" />
      </label>
      <Button type="button" icon-only @click="isDialog = true">
        <IconPlus />
      </Button>
    </div>

    <Dialog v-model:visible="isDialog" modal dismissable-mask>
      <Textarea class="textarea" v-model="currentText"></Textarea>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import ToggleSwitch from "primevue/toggleswitch";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Textarea from "primevue/textarea";

import IconPlus from "@primeicons/vue/plus";

import { readText } from "@tauri-apps/plugin-clipboard-manager";

import { onBeforeUnmount, ref } from "vue";

const currentText = ref("");
const isDialog = ref(false);

const clipboardInterval = ref(0);
const clipboardText = ref("");

onBeforeUnmount(() => {
  if (clipboardInterval.value) {
    clearInterval(clipboardInterval.value);
    clipboardInterval.value = 0;
  }
});

function toggleClipboardMonitor() {
  if (clipboardInterval.value) {
    clearInterval(clipboardInterval.value);
    clipboardInterval.value = 0;
  } else {
    clipboardInterval.value = setInterval(async () => {
      const newText = (await readText()).trim();
      if (
        !/[\p{sc=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{sc=Hangul}]/u.test(
          newText.slice(0, 10),
        )
      ) {
        return;
      }

      if (clipboardText.value === newText) return;

      clipboardText.value = newText;
      currentText.value = newText;
    }, 1000);
  }
}
</script>

<style scoped>
.container {
  padding: 1em;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.row {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 1em;
}

.row + .row {
  margin-top: 1em;
}

.flex-grow-1 {
  flex-grow: 1;
}

.textarea {
  width: calc(100vw - 4em);
  max-width: 1000px;
  height: calc(80vh - 4em);
}
</style>
