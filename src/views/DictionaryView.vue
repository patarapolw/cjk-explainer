<template>
  <main class="container">
    <InputText
      inputmode="search"
      name="term"
      v-model="q"
      autocapitalize="none"
      autocorrect="off"
      autocomplete="off"
      spellcheck="false"
      @input="onTermInput"
    />
    <div class="scroller" ref="scroller" @scroll.passive="onScroll">
      <div v-for="(it, i) in items" :key="i">
        <pre>{{ JSON.stringify({ it, i }, null, 2) }}</pre>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import { nextTick, onMounted, ref, useTemplateRef, watch } from "vue";
import { toKana } from "wanakana";

import { searchDB } from "../db/search";
import { settingsState } from "../util/settings";

const q = ref("");
const items = ref<{}[]>([]);

const loading = ref(false);
const nextOffset = ref<number | null>(0);

const elScroller = useTemplateRef("scroller");

let activeRequest: Promise<void> | null = null;
let requestId = 0;

watch([q, settingsState.computed.lang], async () => {
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
    const lang = settingsState.computed.lang.value;
    if (lang === "ja-JP") {
      const conv = (s: string) =>
        toKana(s, { useObsoleteKana: true, IMEMode: true });

      let { selectionStart } = target;
      selectionStart = selectionStart || q.value.length;
      const qPrefix = conv(q.value.substring(0, selectionStart));

      q.value = qPrefix + q.value.substring(selectionStart);
      let i = 0;
      for (; i < qPrefix.length; i++) {
        if (q.value[i] !== qPrefix[i]) break;
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
  const term = q.value;
  const offset = nextOffset.value;
  const oldItems = items.value;

  const request = (async () => {
    try {
      const result = await searchDB.search({
        term,
        limit: 5,
        offset,
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

onMounted(() => {
  loadMore();
});
</script>

<style scoped>
.container {
  padding: 1em;
  height: calc(100vh - 3em);
  display: grid;
  grid-template-rows: auto 1fr;
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
