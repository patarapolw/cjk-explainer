import { createMemoryHistory, createRouter } from "vue-router";

import ExplainerView from "./views/Explainer.vue";
import SettingsView from "./views/Settings.vue";

const routes = [
  { path: "/", component: ExplainerView },
  { path: "/settings", component: SettingsView },
];

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
});
