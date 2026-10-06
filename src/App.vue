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
      </header>
      <RouterView />
    </SidebarMain>
  </SidebarLayout>
  <Dialog :visible="toBeLoaded.length > 0" modal :closable="false">
    <div class="modal-content">
      <Downloading ref="loading_1" v-bind="toBeLoaded[0]" />
      <Downloading v-for="(d, i) in toBeLoaded.slice(1)" :key="i" v-bind="d" />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

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

import { makeLinderaDownloadList } from "./util/tokenize";
import { toBeLoaded } from "./util/loading.ts";

const elLoading_1 = useTemplateRef("loading_1");

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

  toBeLoaded.value = [
    ...toBeLoaded.value,
    ...makeLinderaDownloadList(["unidic", "ko-dic", "cc-cedict"]),
  ];

  loadAll().then(async () => {
    await loadSegmenters();
  });
});

onBeforeUnmount(() => {
  if (mql && onMqlChange) {
    mql.removeEventListener("change", onMqlChange);
  }
});

async function loadAll() {
  while (toBeLoaded.value) {
    const remaining = await new Promise<number>((resolve, reject) => {
      nextTick(() => {
        if (elLoading_1.value) {
          elLoading_1.value
            .start()
            .then(() => {
              toBeLoaded.value = toBeLoaded.value.slice(1);
              resolve(toBeLoaded.value.length);
            })
            .catch(reject);
        } else {
          resolve(0);
        }
      });
    });

    if (remaining <= 0) {
      break;
    }
  }
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
