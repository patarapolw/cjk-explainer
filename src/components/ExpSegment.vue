<template>
  <span :lang="lang">
    <span>{{ tHead }}</span>
    <span :class="isOpActive ? 'emphasis' : ''">{{ cleanedText }}</span>
    <span
      v-if="
        /[\p{sc=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{sc=Hangul}]/u.test(
          cleanedText,
        )
      "
    >
      <Button
        type="button"
        @click="(ev) => (op ? op.toggle(ev) : null)"
        severity="secondary"
        :variant="isOpActive ? '' : 'outlined'"
      >
        ...
      </Button>

      <Popover ref="op" @show="isOpActive = true" @hide="isOpActive = false">
        <button type="button" @click="doExplain()" :disabled="isThinking">
          {{ explanation ? "New explanation" : "Explain" }}
        </button>

        <div class="explain">
          <details v-if="thinking">
            <summary class="reasoning-summary" :lang="lang">
              {{ isThinking ? thinking.split("\n").pop() || "..." : "thought" }}
            </summary>
            <div
              class="reasoning"
              :lang="lang"
              v-html="markdownIt.render(thinking)"
            ></div>
          </details>

          <div :lang="lang" v-html="markdownIt.render(explanation)"></div>
        </div>
      </Popover>
    </span>
  </span>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";

import Popover from "primevue/popover";
import Button from "primevue/button";

import { LLMstream } from "../util/llm";
import { markdownIt } from "../util/markdown";
import { settingsState } from "../util/settings";
import { getExplanation, saveExplanation } from "../db/explainer";

const { text, lang } = defineProps<{
  text: string;
  lang: string;
}>();

const cleanedText = text.trim();
const tHead = text.substring(0, text.indexOf(cleanedText));

const op = useTemplateRef("op");
const isOpActive = ref(false);
const explanation = ref("");

const thinking = ref("");
const isThinking = ref(false);

onMounted(async () => {
  const newExplanation = await getExplanation({ text: cleanedText, lang });
  if (newExplanation) {
    explanation.value = newExplanation;
  }
});

async function doExplain() {
  explanation.value = "";
  thinking.value = "";
  isThinking.value = true;

  for await (const t of LLMstream({
    model: "deepseek-v4-flash",
    messages: [
      {
        role: "system",
        content: settingsState.explainerPrompt,
      },
      { role: "user", content: cleanedText },
    ],
  })) {
    if (t.done) break;
    if (t.reasoning) {
      thinking.value += t.reasoning;
    }

    explanation.value += t.content;
  }

  await saveExplanation({
    text: cleanedText,
    lang,
    explanation: explanation.value,
  });

  isThinking.value = false;
}
</script>

<style scoped>
.explain {
  width: 500px;
  max-width: min(90vw, 600px);
  min-height: 200px;
  max-height: 80vh;
  overflow: auto;
}

.reasoning {
  padding: 1em;

  max-height: 400px;
  overflow-y: scroll;

  -ms-overflow-style: none; /* Internet Explorer 10+ */
  scrollbar-width: none; /* Firefox, Safari 18.2+, Chromium 121+ */
  &::-webkit-scrollbar {
    display: none; /* Older Safari and Chromium */
  }
}

.reasoning-summary {
  height: 1.5em;
  overflow: hidden;
  cursor: pointer;
}

.emphasis {
  border: 1px solid rgba(255, 0, 0, 0.5);
  border-radius: 5px;
}
</style>
