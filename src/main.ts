import PrimeVue from "primevue/config";
import { createApp } from "vue";

import Aura from "@primeuix/themes/aura";

import App from "./App.vue";
import { router } from "./router.ts";

const app = createApp(App);

app
  .use(PrimeVue, {
    theme: {
      preset: Aura,
    },
    license: import.meta.env.VITE_PRIMEUI_LICENSE_KEY,
  })
  .use(router)
  .mount("#app");
