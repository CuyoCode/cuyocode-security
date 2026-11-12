import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import BrowserFallback from './components/BrowserFallback.vue';
import router from './router';
import './assets/styles/global.css';

const hasApi = typeof window !== 'undefined' && Boolean((window as unknown as { api?: unknown }).api);

const app = createApp(hasApi ? App : BrowserFallback);
if (hasApi) {
  app.use(createPinia());
  app.use(router);
}
app.mount('#app');
