import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  marketApi,
  type ExchangeItem,
  type ListingHistoryItem,
  type ListingItem,
} from '../api/market'

export const useMarketStore = defineStore('market', () => {
  const exchanges = ref<ExchangeItem[]>([])
  const listings = ref<ListingItem[]>([])
  const currentListing = ref<ListingItem | null>(null)
  const currentHistory = ref<ListingHistoryItem[]>([])

  const loading = ref(false)
  const detailsLoading = ref(false)
  const error = ref('')

  async function fetchExchanges() {
    try {
      const res = await marketApi.listExchanges()
      exchanges.value = res.data.exchanges ?? []
    } catch (e: any) {
      exchanges.value = []
      error.value = e.response?.data?.message || 'Failed to load exchanges.'
    }
  }

  async function fetchListings(query = '') {
    loading.value = true
    error.value = ''
    try {
      const res = await marketApi.listListings(query)
      listings.value = res.data.listings ?? []
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load listings.'
    } finally {
      loading.value = false
    }
  }

  async function fetchListingDetails(ticker: string) {
    detailsLoading.value = true
    error.value = ''
    try {
      const [listingRes, historyRes] = await Promise.all([
        marketApi.getListing(ticker),
        marketApi.getListingHistory(ticker),
      ])
      currentListing.value = listingRes.data.listing
      currentHistory.value = historyRes.data.history ?? []
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Failed to load security details.'
      currentListing.value = null
      currentHistory.value = []
    } finally {
      detailsLoading.value = false
    }
  }

  return {
    exchanges,
    listings,
    currentListing,
    currentHistory,
    loading,
    detailsLoading,
    error,
    fetchExchanges,
    fetchListings,
    fetchListingDetails,
  }
})
