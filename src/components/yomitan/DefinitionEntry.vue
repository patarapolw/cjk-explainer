<template>
  <p v-if="typeof def === 'string'">{{ def }}</p>

  <template v-else-if="def && !Array.isArray(def) && def.type">
    <p v-if="def.type === 'text'">{{ def.text }}</p>

    <StructuredContent
      v-else-if="def.type === 'structured-content'"
      :node="def.content"
      :dictionary="dictionary"
      :get-asset-src="getAssetSrc"
      :on-anchor-clicked="onAnchorClicked"
    />

    <figure v-else-if="def.type === 'image'">
      <img
        :src="resolvedSrc"
        :width="def.width"
        :height="def.height"
        :title="def.title"
        :alt="def.alt"
      />
      <figcaption v-if="def.description">{{ def.description }}</figcaption>
    </figure>
  </template>

  <p v-else-if="Array.isArray(def)" class="deinflection">
    <span class="uninflected">{{ def[0] }}</span>
    <span v-if="def[1]?.length" class="rules">({{ def[1].join(" → ") }})</span>
  </p>
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import StructuredContent from "./StructuredContent.vue";

const props = defineProps<{
  def: string | { type: string; [k: string]: any } | [string, string[]];
  dictionary: string;
  getAssetSrc: (dict: string, path: string) => Promise<string>;
  onAnchorClicked?: (src: string) => void;
}>();

const resolvedSrc = ref("");
watchEffect(async () => {
  const d = props.def as any;
  if (d && !Array.isArray(d) && d.type === "image" && d.path) {
    try {
      resolvedSrc.value = await props.getAssetSrc(props.dictionary, d.path);
    } catch (err) {
      console.error("Failed to resolve asset:", err);
      resolvedSrc.value = "";
    }
  } else {
    resolvedSrc.value = "";
  }
});
</script>
