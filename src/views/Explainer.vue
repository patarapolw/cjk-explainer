<template>
  <main class="container">
    <div class="row">
      <InputText class="flex-grow" v-model="currentText" />
    </div>
    <div class="row">
      <div class="flex-grow"></div>
      <label class="row" @click.prevent="toggleClipboardMonitor()">
        <span>Clipboard</span>
        <ToggleSwitch :model-value="clipboardInterval !== 0" />
      </label>
      <Button
        type="button"
        icon-only
        @click="isDialogTextarea = true"
        severity="info"
      >
        <IconExpand />
      </Button>
      <Button
        type="button"
        :disabled="!currentText.trim()"
        @click="isDialogExplainer = true"
        icon-only
      >
        <IconBolt />
      </Button>
    </div>

    <Dialog v-model:visible="isDialogTextarea" modal dismissable-mask>
      <template #header>
        <div class="flex-grow"></div>
        <Button
          type="button"
          :disabled="!currentText.trim()"
          @click="isDialogExplainer = true"
          icon-only
          style="margin-inline-end: 1em"
        >
          <IconBolt />
        </Button>
      </template>
      <Textarea class="modal-content" v-model="currentText"></Textarea>
    </Dialog>

    <Dialog v-model:visible="isDialogExplainer" modal dismissable-mask>
      <template #header>
        <div style="text-overflow: ellipsis; height: 1.5em">
          {{ currentText.slice(0, 50) }}
        </div>
      </template>
      <div class="modal-content">
        <component
          :is="t === 'br' ? 'br' : ExpSegment"
          v-for="(t, i) in splitSentences(currentText)"
          :key="i"
          :text="t"
          lang="ko"
        />
      </div>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import ToggleSwitch from "primevue/toggleswitch";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Textarea from "primevue/textarea";

import IconExpand from "@primeicons/vue/expand";
import IconBolt from "@primeicons/vue/bolt";

import { readText } from "@tauri-apps/plugin-clipboard-manager";

import { onBeforeUnmount, ref } from "vue";

import ExpSegment from "../components/ExpSegment.vue";

const currentText = ref("");
const isDialogTextarea = ref(false);
const isDialogExplainer = ref(false);

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

function splitSentences(text: string) {
  const out: string[] = [];

  let seg = "";

  text.split(/(。|. |\n)/g).forEach((t, i) => {
    if (i % 2) {
      if (t === "\n") {
        out.push(seg);
        out.push("br");
      } else {
        out.push(seg + t);
      }

      seg = "";
    } else {
      seg += t;
    }
  });

  if (seg) {
    out.push(seg);
  }

  return out.filter((t) => t.trim());
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
  gap: 0.5em;
}

.row + .row {
  margin-top: 1em;
}

.flex-grow {
  flex-grow: 1;
}

.modal-content {
  width: calc(100vw - 4em);
  max-width: 1000px;
  height: calc(80vh - 4em);
}
</style>
