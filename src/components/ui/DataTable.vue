<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :style="{ width: col.width, textAlign: col.align ?? 'left' }">
            {{ col.label }}
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="n in 4" :key="'s' + n">
          <td :colspan="columns.length"><span class="skeleton"></span></td>
        </tr>
      </tbody>
      <tbody v-else-if="rows.length === 0">
        <tr>
          <td :colspan="columns.length">
            <EmptyState :title="emptyTitle ?? 'Sin resultados'" :description="emptyDescription ?? ''" :icon="emptyIcon ?? 'spark'">
              <slot name="empty" />
            </EmptyState>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="row in rows" :key="String(row[rowKey ?? 'id'])">
          <td v-for="col in columns" :key="col.key" :style="{ textAlign: col.align ?? 'left' }">
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ display(row[col.key]) }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import EmptyState from './EmptyState.vue';

interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

withDefaults(
  defineProps<{
    columns: TableColumn[];
    rows: Array<Record<string, unknown>>;
    rowKey?: string;
    loading?: boolean;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyIcon?: string;
  }>(),
  {
    rowKey: 'id',
    loading: false,
    emptyTitle: 'Sin resultados',
    emptyDescription: '',
    emptyIcon: 'spark',
  },
);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
</script>

<style scoped>
.table-wrap { overflow-x: auto; }
table { min-width: 560px; }
.skeleton {
  display: block;
  height: 14px;
  width: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--bg-soft), var(--bg-hover), var(--bg-soft));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer { to { background-position: -200% 0; } }
</style>
