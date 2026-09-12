<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

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

import SidebarIcon from "@primeicons/vue/sidebar";
import TextColorIcon from "@primeicons/vue/text-color";
import CogIcon from "@primeicons/vue/cog";

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
});

onBeforeUnmount(() => {
  if (mql && onMqlChange) {
    mql.removeEventListener("change", onMqlChange);
  }
});
</script>

<template>
  <SidebarLayout style="overflow: hidden">
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
                    <SidebarMenuButton :is-active="true">
                      <TextColorIcon />
                      <span>Text</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <CogIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </SidebarPanel>
      </SidebarAside>
    </Sidebar>

    <SidebarMain>
      <header
        style="
          display: flex;
          flex-direction: row;
          align-items: center;
          height: 3rem;
          padding: 0.5rem;
          gap: 0.5rem;
        "
      >
        <SidebarTrigger
          target="nav"
          severity="secondary"
          :text="true"
          size="small"
        >
          <SidebarIcon />
        </SidebarTrigger>
        <span class="text-sm font-medium flex-1" style="flex-grow: 1">
          Dashboard
        </span>
      </header>
      <RouterView />
    </SidebarMain>
  </SidebarLayout>
</template>

<style>
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100vh;
  width: 100vw;
}

:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;

  color: #0f0f0f;
  background-color: #f6f6f6;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}

a:hover {
  color: #535bf2;
}

h1 {
  text-align: center;
}

input,
button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  color: #0f0f0f;
  background-color: #ffffff;
  transition: border-color 0.25s;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2);
}

button {
  cursor: pointer;
}

button:hover {
  border-color: #396cd8;
}
button:active {
  border-color: #396cd8;
  background-color: #e8e8e8;
}

input,
button {
  outline: none;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #f6f6f6;
    background-color: #2f2f2f;
  }

  a:hover {
    color: #24c8db;
  }

  input,
  button {
    color: #ffffff;
    background-color: #0f0f0f98;
  }
  button:active {
    background-color: #0f0f0f69;
  }
}
</style>
