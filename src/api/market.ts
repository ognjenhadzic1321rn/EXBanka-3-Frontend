import clientApi from './clientAuth'

export interface ExchangeItem {
  name: string
  acronym: string
  micCode: string
  polity: string
  currency: string
  timezone: string
  workingHours: string
  enabled: boolean
}

export interface ExchangeSummary {
  name: string
  acronym: string
  micCode: string
  currency: string
}

export interface ListingItem {
  ticker: string
  name: string
  exchange: ExchangeSummary
  lastRefresh: string
  price: number
  ask: number
  bid: number
  volume: number
  type: string
}

export interface ListingHistoryItem {
  date: string
  price: number
  high: number
  low: number
  change: number
  volume: number
}

export interface OptionItem {
  ticker: string
  name: string
  price: number
  ask: number
  bid: number
  volume: number
  optionType: 'CALL' | 'PUT'
  strikePrice: number
  impliedVolatility: number
  openInterest: number
  settlementDate: string
}

export interface OptionsChain {
  ticker: string
  stockPrice: number
  options: OptionItem[]
  count: number
}

export const marketApi = {
  listExchanges: () => clientApi.get<{ exchanges: ExchangeItem[]; count: number }>('/exchanges'),
  listListings: (q = '', type = '') => clientApi.get<{ listings: ListingItem[]; count: number; query: string }>('/listings', {
    params: { q: q || undefined, type: type || undefined },
  }),
  getListing: (ticker: string) => clientApi.get<{ listing: ListingItem }>(`/listings/${ticker}`),
  getListingHistory: (ticker: string) => clientApi.get<{ ticker: string; history: ListingHistoryItem[] }>(`/listings/${ticker}/history`),
  getOptionsChain: (ticker: string) => clientApi.get<OptionsChain>(`/listings/${ticker}/options`),
}
