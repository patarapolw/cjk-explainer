<template>
  <main class="container">
    <InputText v-model="q" />
    <div class="scroller" ref="scroller" @scroll.passive="onScroll">
      <pre v-for="(it, i) in items" :key="i">
        {{ JSON.stringify({ it, i }, null, 2) }}
      </pre>
    </div>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import { nextTick, onMounted, ref, useTemplateRef, watch } from "vue";
import { searchDB } from "../db/search";
import { settingsState } from "../util/settings";

const q = ref("");
const items = ref<{}[]>([]);

const loading = ref(false);
const nextOffset = ref<number | null>(0);

const elScroller = useTemplateRef("scroller");

watch([q, settingsState.computed.lang], () => {
  loading.value = false;
  nextOffset.value = 0;
  loadMore(true);
});

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
  try {
    const result = await searchDB.search({
      term: q.value,
      limit: 5,
      offset: nextOffset.value,
    });
    items.value = isNew ? result.items : [...items.value, ...result.items];
    nextOffset.value = result.next;

    if (isNew && elScroller.value) {
      elScroller.value.scrollTop = 0;
    }
  } finally {
    loading.value = false;
  }

  await nextTick();
  onScroll();
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
