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
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

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


import { settingsState } from "./util/settings.ts";


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
</style>
