import { createMemoryHistory, createRouter } from "vue-router";

import ExplainerView from "./views/Explainer.vue";
import SettingsView from "./views/Settings.vue";

const routes = [
  { path: "/", redirect: "/explain" },
  { path: "/explain", component: ExplainerView },
  { path: "/settings", component: SettingsView, name: "Settings" },
];

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
});
