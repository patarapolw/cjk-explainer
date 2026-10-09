<template>
  <main class="container">
    <InputText />
    <div class="scroller" ref="scroller" @scroll.passive="onScroll">
      <pre v-for="(it, i) in items" :key="i">
        {{ JSON.stringify({ it, i }, null, 2) }}
      </pre>
    </div>
  </main>
</template>

<script setup lang="ts">
import InputText from "primevue/inputtext";
import { nextTick, onMounted, ref, useTemplateRef } from "vue";

const items = ref<typeof allItems>([]);

const loading = ref(false);
const nextOffset = ref<number | null>(0);

const elScroller = useTemplateRef("scroller");

function onScroll() {
  const el = elScroller.value;
  if (!el || loading.value || nextOffset.value === null) return;

  const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (remaining < el.clientHeight / 2) loadMore();
}

async function loadMore() {
  if (loading.value || nextOffset.value === null) return;

  loading.value = true;
  try {
    const result = await getArticles(nextOffset.value);
    items.value = [...items.value, ...result.items];
    nextOffset.value = result.next;
  } finally {
    loading.value = false;
  }

  await nextTick();
  onScroll();
}

const itemSize = 5;
const allItems = Array.from({ length: 100 }).map((_, i) =>
  ((i + 1) << 20).toString(36),
);
async function getArticles(offset: number) {
  const endOffset = offset + itemSize;
  const items = allItems.slice(offset, offset + itemSize);
  const next = endOffset < allItems.length ? offset + items.length : null;

  await new Promise((resolve) => setTimeout(resolve, 500));

  return { items, next };
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
