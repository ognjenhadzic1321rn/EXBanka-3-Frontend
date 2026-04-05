import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  clientPortfolioApi,
  employeePortfolioApi,
} from '../api/portfolio'
import type { Holding, PortfolioSummary } from '../api/portfolio'

// ---------------------------------------------------------------------------
// Shared factory — keeps both stores DRY
// ---------------------------------------------------------------------------

function createPortfolioStore(
  id: string,
  api: typeof clientPortfolioApi | typeof employeePortfolioApi,
) {
  return defineStore(id, () => {
    const summary = ref<PortfolioSummary | null>(null)
    const loading = ref(false)
    const error = ref('')

    // The backend's GET /portfolio already returns holdings embedded in the
    // summary object, so one request gives us everything we need.
    const holdings = computed<Holding[]>(() => summary.value?.holdings ?? [])

    // ---- aggregate computeds ----
    const totalValue = computed(() =>
      holdings.value.reduce((s, h) => s + h.marketValue, 0)
    )
    const totalUnrealizedPnL = computed(() =>
      holdings.value.reduce((s, h) => s + h.unrealizedPnL, 0)
    )
    const totalRealizedProfit = computed(() =>
      holdings.value.reduce((s, h) => s + h.realizedProfit, 0)
    )
    const holdingsByType = computed(() => {
      const map: Record<string, Holding[]> = {}
      for (const h of holdings.value) {
        ;(map[h.assetType] ??= []).push(h)
      }
      return map
    })

    // ---- actions ----
    async function fetchAll() {
      loading.value = true
      error.value = ''
      try {
        const res = await api.getSummary()
        summary.value = res.data.portfolio
      } catch (e: any) {
        error.value = e?.response?.data?.message ?? 'Failed to load portfolio.'
        summary.value = null
      } finally {
        loading.value = false
      }
    }

    function clear() {
      summary.value = null
      error.value = ''
    }

    return {
      summary,
      holdings,
      loading,
      error,
      totalValue,
      totalUnrealizedPnL,
      totalRealizedProfit,
      holdingsByType,
      fetchAll,
      clear,
    }
  })
}

// ---------------------------------------------------------------------------
// Exported stores
// ---------------------------------------------------------------------------

export const useClientPortfolioStore = createPortfolioStore(
  'clientPortfolio',
  clientPortfolioApi,
)

export const useEmployeePortfolioStore = createPortfolioStore(
  'employeePortfolio',
  employeePortfolioApi,
)
