<template>
  <main class="container">
    <header>
      <InputGroup>
        <InputText
          inputmode="search"
          name="term"
          v-model="q"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          spellcheck="false"
          @input="onTermInput"
          fluid
        />
        <InputGroupAddon>
          <SelectButton
            v-model="qState"
            :options="qStateOptions"
            option-label="label"
            option-value="value"
          />
        </InputGroupAddon>
      </InputGroup>
      <nav>
        <label v-if="['', 'ja-JP'].includes(settingsState.computed.lang.value)">
          <input type="checkbox" name="autokana" v-model="autoKana" />
          <span>Auto-convert to Kana</span>
        </label>

        <label @click.prevent="toggleClipboardMonitor()">
          <input
            type="checkbox"
            name="clipboard"
            :model-value="clipboardInterval !== 0"
          />
          <span>Clipboard monitor</span>
        </label>
      </nav>
    </header>
    <div class="scroller" ref="scroller" @scroll.passive="onScroll">
      <div v-for="(it, i) in items" :key="i">
        <pre>{{ JSON.stringify({ it, i }, null, 2) }}</pre>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";

import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { toKana } from "wanakana";

import { searchDB } from "../db/search";
import { settingsState } from "../util/settings";
import { readText } from "@tauri-apps/plugin-clipboard-manager";

const q = ref("");
const items = ref<{}[]>([]);

const qStateOptions = ref([
  { label: "~", value: "fts" },
  { label: "=", value: "exact" },
]);
const qState = ref<string | null>(null);

const autoKana = ref(true);

const loading = ref(false);
const nextOffset = ref<number | null>(0);

const clipboardInterval = ref(0);
const clipboardText = ref("");

const elScroller = useTemplateRef("scroller");

let activeRequest: Promise<void> | null = null;
let requestId = 0;

watch([q, qState, settingsState.computed.lang], async () => {
  const id = ++requestId;
  await activeRequest;
  if (id !== requestId) return;

  nextOffset.value = 0;
  loadMore(true);
});

let isWanakanaFinished = true;

function onTermInput({ target }: InputEvent) {
  if (!(target instanceof HTMLInputElement)) return;
  if (!isWanakanaFinished) return;

  isWanakanaFinished = false;
  try {
    if (
      autoKana.value &&
      ["", "ja-JP"].includes(settingsState.computed.lang.value)
    ) {
      const conv = (s: string) =>
        toKana(s, { useObsoleteKana: true, IMEMode: true });

      let { selectionStart } = target;
      selectionStart = selectionStart || q.value.length;
      const qPrefix = conv(q.value.substring(0, selectionStart));

      q.value = qPrefix + q.value.substring(selectionStart);
      let i = 0;
      for (const c of qPrefix) {
        if (q.value[i++] !== c) break;
      }

      nextTick(() => {
        target.selectionStart = i;
        target.selectionEnd = i;
      });
    }
  } finally {
    isWanakanaFinished = true;
  }
}

function onScroll() {
  const el = elScroller.value;
  if (!el || loading.value || nextOffset.value === null) return;

  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (remaining < el.clientHeight / 2) loadMore();
}

async function loadMore(isNew?: boolean) {
  if (loading.value || nextOffset.value === null) return;
  if (!q.value) return;

  loading.value = true;

  const id = requestId;
  let term = q.value.trim();
  const offset = nextOffset.value;
  const oldItems = items.value;
  let type = qState.value;

  const request = (async () => {
    try {
      if (type !== "exact" && term.includes(" ")) {
        term = term.split(" ", 2)[0];
        type = type || "exact";
      }

      const result = await searchDB.search({
        term,
        limit: 5,
        offset,
        type,
      });

      items.value = isNew ? result.items : [...oldItems, ...result.items];
      nextOffset.value = result.next;

      if (isNew && elScroller.value) {
        elScroller.value.scrollTop = 0;
      }
    } finally {
      loading.value = false;
    }
  })();

  activeRequest = request;
  await request;

  if (activeRequest === request) activeRequest = null;

  // Only check after this request updated the current query's items.
  if (id === requestId) {
    await nextTick();
    onScroll();
  }
}

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
      q.value = newText;
    }, 1000);
  }
}

onBeforeUnmount(() => {
  if (clipboardInterval.value) {
    clearInterval(clipboardInterval.value);
    clipboardInterval.value = 0;
  }
});
</script>

<style scoped>
.container {
  padding: 1em;
  height: calc(100vh - 3em);
  display: grid;
  grid-template-rows: auto 1fr;

  nav * + * {
    margin-inline-start: 0.5em;
  }
}

.scroller {
  overflow: auto;
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
</style>
