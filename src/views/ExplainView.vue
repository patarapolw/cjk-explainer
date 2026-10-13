<template>
  <main class="container">
    <div class="row">
      <button type="reset" @click="currentText = ''">Clear</button>
      <div class="flex-grow"></div>
      <label class="row" @click.prevent="toggleClipboardMonitor()">
        <span>Clipboard</span>
        <ToggleSwitch :model-value="clipboardInterval !== 0" />
      </label>
      <Button
        type="button"
        :disabled="!currentText.trim()"
        @click="isDialogExplainer = true"
        icon-only
      >
        <IconBolt />
      </Button>
    </div>
    <div class="row">
      <Textarea class="flex-grow textarea" v-model="currentText"></Textarea>
    </div>

    <Dialog v-model:visible="isDialogExplainer" modal dismissable-mask>
      <div class="modal-content">
        <component
          :is="t === '<br/>' ? 'br' : ExpSegment"
          v-for="(t, i) in splitSentences(currentText)"
          :key="i"
          :text="t"
          :lang="currentLang"
        />
      </div>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
import ToggleSwitch from "primevue/toggleswitch";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Textarea from "primevue/textarea";

import IconBolt from "@primeicons/vue/bolt";

import { readText } from "@tauri-apps/plugin-clipboard-manager";

import { onBeforeUnmount, ref, watch } from "vue";

import ExpSegment from "../components/ExpSegment.vue";
import { settingsState } from "../util/settings.ts";

const currentText = ref("");
const currentLang = ref("zh-CN");
const isDialogExplainer = ref(false);

watch(isDialogExplainer, () => {
  if (isDialogExplainer.value) {
    if (settingsState.computed.lang.value) {
      currentLang.value = settingsState.computed.lang.value;
      return;
    }

    const excerpt = currentText.value.trim().slice(0, 100);

    if (/[ぁ-ゟ]/u.test(excerpt)) {
      // Japanese \p{scx} appears to catch Chinese punctuations...
      currentLang.value = "ja-JP";
    } else if (/[\p{sc=Hangul}]/u.test(excerpt)) {
      currentLang.value = "ko-KR";
    } else if (/[\p{sc=Han}]/u.test(excerpt)) {
      currentLang.value = "zh-CN";
    }
  }
});

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

  text.split(/(。|\. |\n)/g).forEach((t, i) => {
    if (i % 2) {
      if (t === "\n") {
        out.push(seg);
        out.push("<br/>");
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

.modal-header {
  overflow: hidden;
  text-overflow: ellipsis;
  height: 1.5em;
}

.modal-content {
  width: calc(100vw - 4em);
  max-width: 1000px;
  height: calc(80vh - 4em);
}

.textarea {
  height: calc(90vh - 6rem);
}
</style>
