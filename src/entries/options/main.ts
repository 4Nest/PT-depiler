import "vue-sonner/style.css";
import "~/styles/globals.css";

import { createApp } from "vue";
import App from "./App.vue";
import { piniaInstance as pinia } from "./plugins/pinia";
import { routerInstance as router } from "./plugins/router";
import { i18nInstance as i18n } from "./plugins/i18n";

createApp(App).use(pinia).use(i18n).use(router).mount("#app");
