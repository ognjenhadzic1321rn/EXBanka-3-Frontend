import api from './client'
import type {
  ExchangeItem,
  ListingHistoryItem,
  ListingItem,
  OptionsChain,
} from './market'

export const employeeMarketApi = {
  listExchanges: () => api.get<{ exchanges: ExchangeItem[]; count: number }>('/exchanges'),
  listListings: (q = '', type = '') =>
    api.get<{ listings: ListingItem[]; count: number; query: string }>('/listings', {
      params: { q: q || undefined, type: type || undefined },
    }),
  getListing: (ticker: string) => api.get<{ listing: ListingItem }>(`/listings/${ticker}`),
  getListingHistory: (ticker: string) =>
    api.get<{ ticker: string; history: ListingHistoryItem[] }>(`/listings/${ticker}/history`),
  getOptionsChain: (ticker: string) => api.get<OptionsChain>(`/listings/${ticker}/options`),
}
