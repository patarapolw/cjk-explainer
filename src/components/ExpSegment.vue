<template>
  <span>
    {{ text }}
    <span
      v-if="
        /[\p{sc=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{sc=Hangul}]/u.test(text)
      "
    >
      <button type="button" @click="(ev) => (op ? op.toggle(ev) : null)">
        ...
      </button>
      <Popover ref="op">
        <button type="button" @click="doExplain()" :disabled="isThinking">
          {{ explanation ? "New explanation" : "Explain" }}
        </button>

        <div class="explain">
          <details v-if="thinking">
            <summary>
              {{ isThinking ? "thinking..." : "thought" }}
            </summary>
            <div class="reasoning" v-html="markdownIt.render(thinking)"></div>
          </details>

          <div v-html="markdownIt.render(explanation)"></div>
        </div>
      </Popover>
    </span>
  </span>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";

import Popover from "primevue/popover";

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

const op = useTemplateRef("op");
const explanation = ref("");

const thinking = ref("");
const isThinking = ref(false);

onMounted(async () => {
  const [r] = await dbExplainer.select<IExplainer[]>(
    /* sql */ `SELECT [text], [explanation] FROM explainer WHERE lang = $1 AND [text] = $2 LIMIT 1`,
    [lang, text],
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
          Give me key vocabularies.
          `,
      },
      { role: "user", content: text },
    ],
  })) {
    if (t.done) break;
    if (t.reasoning) {
      thinking.value += t.reasoning;
    }

    explanation.value += t.content;
  }

  await dbExplainer.execute(
    /* sql */ `INSERT INTO explainer ([text], [explanation], [lang]) VALUES ($1, $2, $3)`,
    [text, explanation.value, lang],
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
</style>
