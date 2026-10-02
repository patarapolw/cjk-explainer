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
  <Dialog v-model:visible="isLoading" modal :closable="false">
    <div class="modal-content">
      <p>
        <small>
          Downloading {{ downloading.filepath }} from {{ downloading.url }}
        </small>
      </p>
      <ProgressBar
        v-if="downloading.percentage"
        :value="downloading.percentage"
        :show-value="false"
      />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";

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
import ProgressBar from "primevue/progressbar";

import SidebarIcon from "@primeicons/vue/sidebar";
import TextColorIcon from "@primeicons/vue/text-color";
import CogIcon from "@primeicons/vue/cog";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";

interface DownloadUrlProgress {
  url: string;
  filepath: string;
  contentLength: number;
  downloaded: number;
}

const isLoading = ref(false);
const downloading = reactive({
  url: "",
  filepath: "",
  percentage: 0,
});

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

  const model = "unidic";
  const lindera_version = "6.2.0";
  const filepath = `lindera-${model}-${lindera_version}.zip`;
  exists(filepath, { baseDir: BaseDirectory.AppData })
    .then(async (isExists) => {
      if (!isExists) {
        isLoading.value = true;

        const unlisten = await listen<DownloadUrlProgress>(
          "download-url-progress",
          ({ payload }) => {
            downloading.url = payload.url;
            downloading.filepath = payload.filepath;
            if (payload.contentLength) {
              downloading.percentage = Math.round(
                (100 * payload.downloaded) / payload.contentLength,
              );
            }
          },
        );

        await invoke("download_url", {
          url: `https://github.com/lindera/lindera/releases/download/v${lindera_version}/lindera-${model}-${lindera_version}.zip`,
          filepath,
        }).finally(unlisten);

        await invoke("unzip", { filepath, outDir: "lindera" });
      }
    })
    .then(async () => {
      isLoading.value = false;
      await invoke("segment", {
        lang: "ja-JP",
        text: "おはようございます。おはよう御座います",
      }).then((r) => {
        console.log(r);
        console.log(JSON.stringify(r));
      });
    });
});

onBeforeUnmount(() => {
  if (mql && onMqlChange) {
    mql.removeEventListener("change", onMqlChange);
  }
});
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
