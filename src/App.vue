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
  <Dialog :visible="toBeLoaded.length > 0" modal :closable="false">
    <div class="modal-content">
      <template
        v-for="d in toBeLoaded"
        :key="'filename' in d ? d.filename : d.lang || ''"
      >
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

import Dialog from "primevue/dialog";
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
import YomitanLoader from "./components/YomitanLoader.vue";

import { standardDicts } from "./util/dicts.ts";
import { toBeLoaded, YomitanImportProps } from "./util/loading.ts";
import { settingsState } from "./util/settings.ts";
import { makeLinderaDownloadList } from "./util/tokenize";

// array of refs, or undefined
const elLoading = useTemplateRef("loading");

const isMobile = ref(false);
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

watch(toBeLoaded, () => {
  nextTick(() => {
    const firstLoader = elLoading.value?.[0];
    if (firstLoader) {
      firstLoader.start().then(() => {
        // Exhaustive loop via vue::watch
        toBeLoaded.value = toBeLoaded.value.slice(1);
      });
    }
  });
});

async function loadAll() {
  const dicts = await standardDicts();

  toBeLoaded.value = [
    ...toBeLoaded.value,
    ...(await makeLinderaDownloadList(["unidic", "ko-dic", "cc-cedict"])),
    ...dicts.filter((d) => d.filename),
  ];

  let imp: YomitanImportProps = {
    dictPaths: [],
  };

  for (const d of dicts.sort((a, b) =>
    (a.yomitan?.lang || "").localeCompare(b.yomitan?.lang || ""),
  )) {
    if (!d.yomitan) continue;
    // if (d.yomitan?.parsed) continue;
    if (imp.lang !== d.yomitan.lang) {
      if (imp.dictPaths.length) toBeLoaded.value = [...toBeLoaded.value, imp];
      imp = { dictPaths: [], lang: d.yomitan.lang };
    }
    imp.dictPaths.push(d.outDir!);
  }

  if (imp.dictPaths.length) toBeLoaded.value = [...toBeLoaded.value, imp];
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
