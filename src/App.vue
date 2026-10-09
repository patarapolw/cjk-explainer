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
          <select v-model="settingsState.state.lang">
            <option value="">Auto-detect</option>
            <option value="ja-JP">ja-JP</option>
            <option value="zh-CN">zh-CN</option>
            <option value="ko-KR">ko-KR</option>
          </select>
        </div>
      </header>
      <RouterView />
    </SidebarMain>
  </SidebarLayout>
  <Dialog :visible="toBeLoaded.length > 0" modal :closable="false">
    <div class="modal-content">
      <template v-for="(d, i) in toBeLoaded" :key="i">
        <YomitanLoader ref="loading" v-if="'dictPaths' in d" v-bind="d" />
        <Downloading ref="loading" v-else v-bind="d" />
      </template>
    </div>
  </Dialog>
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

import SidebarLayout from "primevue/sidebarlayout";
import SidebarBackdrop from "primevue/sidebarbackdrop";
import Sidebar from "primevue/sidebar";
import SidebarMain from "primevue/sidebarmain";
import SidebarTrigger from "primevue/sidebartrigger";
import SidebarSpacer from "primevue/sidebarspacer";
import SidebarAside from "primevue/sidebaraside";
import SidebarPanel from "primevue/sidebarpanel";
import SidebarContent from "primevue/sidebarcontent";
import SidebarFooter from "primevue/sidebarfooter";
import SidebarGroup from "primevue/sidebargroup";
import SidebarGroupContent from "primevue/sidebargroupcontent";
import SidebarMenu from "primevue/sidebarmenu";
import SidebarMenuItem from "primevue/sidebarmenuitem";
import SidebarMenuButton from "primevue/sidebarmenubutton";
import Dialog from "primevue/dialog";

import SidebarIcon from "@primeicons/vue/sidebar";
import TextColorIcon from "@primeicons/vue/text-color";
import CogIcon from "@primeicons/vue/cog";

import { invoke } from "@tauri-apps/api/core";

import Downloading from "./components/Downloading.vue";
import YomitanLoader from "./components/YomitanLoader.vue";

import { makeLinderaDownloadList } from "./util/tokenize";
import { toBeLoaded } from "./util/loading.ts";
import { standardDicts } from "./util/dicts.ts";
import { settingsState } from "./util/settings.ts";

// array of refs, or undefined
const elLoading = useTemplateRef("loading");

const isMobile = ref(false);
const navOpen = ref(false);
const open = ref(false);

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

watch(toBeLoaded, () => {
  nextTick(() => {
    const firstLoader = elLoading.value?.[0];
    if (firstLoader) {
      firstLoader.start().then(() => {
        // Exhaustive loop via vue::watch
        toBeLoaded.value = toBeLoaded.value.slice(1);
      });
    } else {
      loadSegmenters();
    }
  });
});

async function loadAll() {
  const dicts = await standardDicts();

  toBeLoaded.value = [
    ...toBeLoaded.value,
    ...(await makeLinderaDownloadList(["unidic", "ko-dic", "cc-cedict"])),
    ...dicts.filter((d) => d.filename),
    { dictPaths: dicts.map((d) => d.outDir!).filter((d) => d) },
  ];
}

async function loadSegmenters() {
  await invoke("segment", {
    lang: "ja-JP",
    text: "おはようございます。おはよう御座います",
  }).then(console.log);

  await invoke("tokenize", {
    lang: "ja-JP",
    text: "おはようございます。おはよう御座います",
  }).then(console.log);

  await invoke("segment", {
    lang: "ko-KR",
    text: "저는 엄마가 밥을 먹은 지 안 먹은 지 몰라요",
  }).then(console.log);

  await invoke("tokenize", {
    lang: "ko-KR",
    text: "저는 엄마가 밥을 먹은 지 안 먹은 지 몰라요",
  }).then(console.log);
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

.modal-content {
  width: calc(100vw - 4em);
  max-width: 1000px;
  height: calc(80vh - 4em);
}
</style>
