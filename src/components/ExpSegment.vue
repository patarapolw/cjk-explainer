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
            <summary>
              {{ isThinking ? "thinking..." : "thought" }}
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

import { dbExplainer } from "../db/explainer";
import { LLMstream } from "../util/llm";
import { markdownIt } from "../util/markdown";

const { text, lang } = defineProps<{
  text: string;
  lang: string;
}>();

export interface IExplainer {
  text: string;
  explanation: string;
}

const cleanedText = text.trim();
const tHead = text.substring(0, text.indexOf(cleanedText));

const op = useTemplateRef("op");
const isOpActive = ref(false);
const explanation = ref("");

const thinking = ref("");
const isThinking = ref(false);

onMounted(async () => {
  const [r] = await dbExplainer.select<IExplainer[]>(
    /* sql */ `SELECT [text], [explanation] FROM explainer WHERE lang = $1 AND [text] = $2 LIMIT 1`,
    [lang, cleanedText],
  );

  if (r) {
    explanation.value = r.explanation;
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
        content: `
          Explain in English how this sentence works in 500 characters.
          Give me key vocabularies, with reading if it's Japanese or Chinese.
          `,
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

  await dbExplainer.execute(
    /* sql */ `INSERT OR REPLACE INTO explainer ([text], [explanation], [lang]) VALUES ($1, $2, $3)`,
    [cleanedText, explanation.value, lang],
  );

  isThinking.value = false;
}
</script>

<style scoped>
.explain {
  width: 500px;
  max-width: min(100vw, 600px);
  min-height: 100px;
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

.emphasis {
  border: 1px solid rgba(255, 0, 0, 0.5);
  border-radius: 5px;
}
</style>
