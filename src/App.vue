<template>
  <div class="shell">
    <div v-if="sidebarOpen" class="sidebar-backdrop" @click="sidebarOpen = false"></div>
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="brand">
        <span class="brand-logo"><img :src="logo" alt="CuyoCode" /></span>
        <span class="brand-text">
          <strong>CuyoCode</strong>
          <small>Security</small>
        </span>
      </div>

      <RouterLink class="cta" to="/wizard" @click="sidebarOpen = false">
        <AppIcon name="plus" :size="16" />
        Nueva auditoría
      </RouterLink>

      <nav aria-label="Navegación principal">
        <div v-for="group in groups" :key="group.label" class="nav-group">
          <p class="nav-label">{{ group.label }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            @click="sidebarOpen = false"
          >
            <AppIcon :name="item.icon" :size="16" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <div class="side-foot">
        <span class="health"><span class="dot"></span>Datos locales</span>
        <span class="version">v{{ version }}</span>
      </div>
    </aside>

    <div class="main-column">
      <header class="topbar">
        <button class="menu" aria-label="Abrir navegación" @click="sidebarOpen = !sidebarOpen">
          <AppIcon name="menu" :size="18" />
        </button>
        <div class="topbar-title" aria-label="Ubicación">
          <span class="crumb-section">{{ section }}</span>
          <span class="crumb-sep">/</span>
          <span class="crumb-page">{{ pageTitle }}</span>
        </div>
        <div class="topbar-actions">
          <BaseButton
            variant="secondary"
            icon="spark"
            size="sm"
            :loading="demoLoading"
            @click="startDemo"
          >
            Probar demo
          </BaseButton>
        </div>
      </header>
      <main class="content">
        <div class="page">
          <RouterView />
        </div>
      </main>
    </div>

    <OnboardingModal
      :open="showOnboarding"
      :demo-loading="demoLoading"
      @close="dismissOnboarding"
      @demo="startDemo"
      @wizard="go('/wizard')"
      @tools="go('/tools')"
    />
    <ToastHost />
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AppIcon from './components/ui/AppIcon.vue';
import BaseButton from './components/ui/BaseButton.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
import ToastHost from './components/ui/ToastHost.vue';
import OnboardingModal from './components/domain/OnboardingModal.vue';
import { useAppStore } from './stores/app';
import { toast } from './composables/useToast';
import logo from './assets/brand/simbolo-color.png';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const sidebarOpen = ref(false);
const demoLoading = ref(false);
const version = computed(() => store.appInfo?.version ?? '0.3.0');
const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : 'CuyoCode Security'));
const section = computed(() => {
  const path = route.path;
  if (path.startsWith('/findings') || path.startsWith('/reports')) return 'Resultados';
  if (path.startsWith('/ssh') || path.startsWith('/lab') || path.startsWith('/tools')) return 'Entorno';
  if (path.startsWith('/settings')) return 'Sistema';
  return 'Auditar';
});

const groups = [
  {
    label: 'Auditar',
    items: [
      { to: '/dashboard', label: 'Panel', icon: 'dashboard' },
      { to: '/audits', label: 'Auditorías', icon: 'history' },
      { to: '/projects', label: 'Proyectos', icon: 'folder' },
    ],
  },
  {
    label: 'Resultados',
    items: [
      { to: '/findings', label: 'Hallazgos', icon: 'alert' },
      { to: '/reports', label: 'Informes', icon: 'report' },
    ],
  },
  {
    label: 'Entorno',
    items: [
      { to: '/ssh', label: 'Servidores SSH', icon: 'server' },
      { to: '/lab', label: 'Laboratorio', icon: 'flask' },
      { to: '/tools', label: 'Herramientas', icon: 'wrench' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ to: '/settings', label: 'Ajustes', icon: 'settings' }],
  },
];

const ONBOARDING_KEY = 'cuyocode:onboarded';
const showOnboarding = ref(false);

function finishOnboarding(): void {
  localStorage.setItem(ONBOARDING_KEY, '1');
  showOnboarding.value = false;
}

function dismissOnboarding(): void {
  finishOnboarding();
}

function go(path: string): void {
  finishOnboarding();
  void router.push(path);
}

async function startDemo(): Promise<void> {
  if (demoLoading.value) return;
  demoLoading.value = true;
  try {
    const result = await window.api.system.demo();
    finishOnboarding();
    await Promise.all([store.refreshDashboard(), store.refreshProjects()]);
    toast.success(
      'Demo preparada',
      `${result.findings} hallazgos sobre el fixture sintético y el laboratorio local.`,
    );
    await router.push('/audits');
  } catch (e) {
    toast.error('No se pudo preparar la demo', e instanceof Error ? e.message : 'Error desconocido');
  } finally {
    demoLoading.value = false;
  }
}

onMounted(() => {
  void store.refreshAppInfo();
  showOnboarding.value = localStorage.getItem(ONBOARDING_KEY) !== '1';
});
</script>

<style scoped>
.shell { display: flex; height: 100%; min-height: 0; }

.sidebar {
  width: var(--sidebar);
  flex-shrink: 0;
  background: var(--bg-soft);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  z-index: 30;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 14px;
  border-bottom: 1px solid var(--border);
}
.brand-logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 4px;
  border-radius: 8px;
  background: #f2f6f9;
  flex-shrink: 0;
}
.brand-logo img { width: 100%; height: 100%; object-fit: contain; display: block; }
.brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.brand-text strong { font-size: 14px; letter-spacing: -0.01em; }
.brand-text small { color: var(--text-faint); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; }

.cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: var(--space-2) 0;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  border: 1px solid var(--accent);
  color: #061412;
  font-size: 13px;
  font-weight: 650;
}
.cta:hover { background: var(--accent-strong); border-color: var(--accent-strong); color: #061412; }

nav { display: flex; flex-direction: column; gap: var(--space-3); flex: 1; overflow-y: auto; padding-right: 2px; }
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-label {
  margin: 4px 8px 2px;
  color: var(--text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text-dim);
  padding: 7px 9px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background var(--transition), color var(--transition);
}
.nav-item:hover { background: var(--bg-panel); color: var(--text); }
.nav-item.router-link-active {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}

.side-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px 4px;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
}
.health { display: inline-flex; align-items: center; gap: 6px; }
.health .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }

.main-column { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--topbar);
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.menu { display: none; background: transparent; border: 1px solid var(--border); padding: 6px; }
.topbar-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px; font-size: 12px; }
.crumb-section { color: var(--text-faint); }
.crumb-sep { color: var(--border-strong); }
.crumb-page { color: var(--text-dim); font-weight: 550; }
.topbar-actions { display: flex; align-items: center; gap: var(--space-2); }

.content { flex: 1; overflow-y: auto; }
.page { max-width: 1320px; margin: 0 auto; padding: var(--space-5); }

.sidebar-backdrop { display: none; }

@media (max-width: 1080px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-102%);
    transition: transform var(--transition);
    box-shadow: var(--shadow-2);
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--overlay);
    z-index: 20;
  }
  .menu { display: inline-flex; }
  .page { padding: var(--space-4); }
}
</style>
