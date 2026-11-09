<template>
  <SidebarLayout class="layout">
    <SidebarBackdrop v-if="isMobile && (navOpen || open)" />
    <Sidebar
      id="nav"
      side="left"
      :collapsible="isMobile ? 'offcanvas' : 'icon'"
      :overlay="isMobile"
      v-model:open="navOpen"
      width="14rem"
    >
      <SidebarSpacer />
      <SidebarAside>
        <SidebarPanel>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <RouterLink
                      to="/explain"
                      v-bind="$props"
                      custom
                      v-slot="{ isActive, navigate }"
                    >
                      <SidebarMenuButton
                        :is-active="isActive"
                        @click="navigate"
                      >
                        <TextColorIcon />
                        <span>Explain</span>
                      </SidebarMenuButton>
                    </RouterLink>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <RouterLink
                  to="/settings"
                  v-bind="$props"
                  custom
                  v-slot="{ isActive, navigate }"
                >
                  <SidebarMenuButton :is-active="isActive" @click="navigate">
                    <CogIcon />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </RouterLink>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </SidebarPanel>
      </SidebarAside>
    </Sidebar>

    <SidebarMain>
      <header class="header">
        <SidebarTrigger
          target="nav"
          severity="secondary"
          :text="true"
          size="small"
        >
          <SidebarIcon />
        </SidebarTrigger>
        <span class="header-panel">
          {{
            $route.name ||
            $route.path
              .split("")
              .map((c, i) => (i ? (i > 1 ? c : c.toLocaleUpperCase()) : ""))
              .join("")
          }}
        </span>
        <div>
          <Select
            v-model="settingsState.state.lang"
            :options="langSelectOptions"
            option-label="label"
            option-value="value"
          />
        </div>
      </header>
      <RouterView />
    </SidebarMain>
  </SidebarLayout>
  <!-- Background downloads: non-modal, the app stays usable meanwhile -->
  <aside
    v-if="toBeLoaded.length || loadErrors.length"
    class="downloads"
    :class="{ collapsed: downloadsCollapsed }"
    aria-live="polite"
  >
    <header class="downloads-header">
      <span v-if="toBeLoaded.length">
        Downloading tokenizer ({{ toBeLoaded.length }} left)
      </span>
      <span v-else>Tokenizer download failed</span>
      <Button
        :label="downloadsCollapsed ? 'Show' : 'Hide'"
        size="small"
        text
        @click="downloadsCollapsed = !downloadsCollapsed"
      />
      <Button
        v-if="!toBeLoaded.length"
        label="Dismiss"
        size="small"
        text
        @click="loadErrors = []"
      />
    </header>
    <div v-show="!downloadsCollapsed" class="downloads-body">
      <Downloading
        v-for="d in toBeLoaded"
        :key="d.filename"
        ref="loading"
        v-bind="d"
      />
      <p v-for="e in loadErrors" :key="e.filename" class="downloads-error">
        {{ e.filename }}: {{ e.error }} (will retry on next launch)
      </p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

import Button from "primevue/button";
import Select from "primevue/select";
import Sidebar from "primevue/sidebar";
import SidebarAside from "primevue/sidebaraside";
import SidebarBackdrop from "primevue/sidebarbackdrop";
import SidebarContent from "primevue/sidebarcontent";
import SidebarFooter from "primevue/sidebarfooter";
import SidebarGroup from "primevue/sidebargroup";
import SidebarGroupContent from "primevue/sidebargroupcontent";
import SidebarLayout from "primevue/sidebarlayout";
import SidebarMain from "primevue/sidebarmain";
import SidebarMenu from "primevue/sidebarmenu";
import SidebarMenuButton from "primevue/sidebarmenubutton";
import SidebarMenuItem from "primevue/sidebarmenuitem";
import SidebarPanel from "primevue/sidebarpanel";
import SidebarSpacer from "primevue/sidebarspacer";
import SidebarTrigger from "primevue/sidebartrigger";

import CogIcon from "@primeicons/vue/cog";
import SidebarIcon from "@primeicons/vue/sidebar";
import TextColorIcon from "@primeicons/vue/text-color";

import Downloading from "./components/Downloading.vue";

import { loadErrors, toBeLoaded } from "./util/loading.ts";
import { settingsState } from "./util/settings.ts";
import { makeLinderaDownloadList } from "./util/tokenize";

// array of refs, or undefined
const elLoading = useTemplateRef("loading");

const isMobile = ref(false);
const downloadsCollapsed = ref(false);
const navOpen = ref(false);
const open = ref(false);

const langSelectOptions = ref([
  { label: "Auto-detect", value: "" },
  { label: "ja-JP", value: "ja-JP" },
  { label: "zh-CN", value: "zh-CN" },
  { label: "ko-KR", value: "ko-KR" },
]);

let mql: MediaQueryList | null = null;
function onMqlChange(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  navOpen.value = !event.matches;
}

onMounted(() => {
  if (typeof window === "undefined") return;

  mql = window.matchMedia("(max-width: 1023px)");
  isMobile.value = mql.matches;
  // navOpen.value = !isMobile.value;

  mql.addEventListener("change", onMqlChange);

  loadAll();
});

onBeforeUnmount(() => {
  if (mql && onMqlChange) {
    mql.removeEventListener("change", onMqlChange);
  }
});

// Process downloads one at a time in the background. A failure is recorded and skipped,
// so the queue never stalls.
let queueRunning = false;
async function runQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (toBeLoaded.value.length) {
      await nextTick();
      const current = toBeLoaded.value[0];
      const loader = elLoading.value?.[0];
      try {
        if (!loader) throw new Error("download component not mounted");
        await loader.start();
      } catch (e) {
        console.error(e);
        loadErrors.value = [
          ...loadErrors.value,
          { filename: current.filename, error: String(e) },
        ];
      }
      toBeLoaded.value = toBeLoaded.value.filter((d) => d !== current);
    }
  } finally {
    queueRunning = false;
  }
}

watch(toBeLoaded, () => {
  if (toBeLoaded.value.length) runQueue();
});

async function loadAll() {
  // lindera dictionaries for client-side tokenizing (search queries, sentence splitting).
  // Yomitan dictionaries are served by the cjk-dict worker; nothing to import locally.
  toBeLoaded.value = [
    ...toBeLoaded.value,
    ...(await makeLinderaDownloadList(["unidic", "ko-dic", "cc-cedict"])),
  ];
}
</script>

<style scoped>
.layout {
  overflow: hidden;
}

.header {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 3rem;
  padding: 0.5rem;
  gap: 0.5rem;
}

.header-panel {
  flex-grow: 1;
}

.downloads {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1000;
  width: min(26rem, calc(100vw - 2rem));
  max-height: 40vh;
  overflow: auto;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--p-content-border-color, #ccc);
  border-radius: 0.5rem;
  background: var(--p-content-background, #fff);
  color: var(--p-text-color, inherit);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
  font-size: 0.875rem;
}

.downloads.collapsed {
  width: auto;
}

.downloads-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.downloads-header > span {
  flex-grow: 1;
}

.downloads-error {
  color: var(--p-red-500, #c00);
}
</style>
