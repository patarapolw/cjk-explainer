import { createRouter, createWebHashHistory } from "vue-router";

const routes = [
  { path: "/", redirect: "/explain" },
  {
    path: "/explain",
    component: () => import("./views/ExplainView.vue"),
    name: "Explain",
  },
  {
    path: "/settings",
    component: () => import("./views/SettingsView.vue"),
    name: "Settings",
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
