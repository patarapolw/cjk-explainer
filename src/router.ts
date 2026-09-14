import { createMemoryHistory, createRouter } from "vue-router";

const routes = [
  { path: "/", redirect: "/explain" },
  {
    path: "/explain",
    component: () => import("./views/Explainer.vue"),
    name: "Explain",
  },
  {
    path: "/settings",
    component: () => import("./views/Settings.vue"),
    name: "Settings",
  },
];

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
});
