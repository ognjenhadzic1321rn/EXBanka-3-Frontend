import { defineStore } from 'pinia'
import { ref } from 'vue'
import { clientAccountApi, type ClientAccountItem } from '../api/clientAccount'

export const useClientAccountStore = defineStore('clientAccount', () => {
  const accounts = ref<ClientAccountItem[]>([])
  const loading = ref(false)
  const error = ref('')

  async function fetchAccounts(clientId: string) {
    loading.value = true
    error.value = ''
    try {
      const res = await clientAccountApi.listByClient(clientId)
      accounts.value = res.data.accounts ?? []
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load accounts.'
    } finally {
      loading.value = false
    }
  }

  return { accounts, loading, error, fetchAccounts }
})
