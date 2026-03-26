import clientApi from './clientAuth'
import api from './client'

export interface Card {
  id: number
  broj_kartice: string
  vrsta_kartice: string
  naziv_kartice: string
  account_id: number
  client_id: number
  status: string
  datum_kreiranja: string
  datum_isteka: string
}

export const CARD_TYPE_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'MasterCard',
  dinacard: 'DinaCard',
  amex: 'American Express',
}

export function maskCardNumber(broj: string): string {
  if (broj.length !== 16) return broj
  return `${broj.slice(0, 4)} **** **** ${broj.slice(12)}`
}

export interface CardRequestResponse {
  id: number
  expires_at: string
  message: string
}

export interface CardVerifyResponse {
  card: Card
  message: string
}

// Client-facing card API (uses client JWT)
export const cardApi = {
  listByClient: (clientId: number | string) =>
    clientApi.get<Card[]>(`/cards/client/${clientId}`),

  blockCard: (cardId: number, clientId: number) =>
    clientApi.put<Card>(`/cards/${cardId}/block`, { clientId }),

  requestCard: (payload: {
    accountId: number
    vrstaKartice: string
    nazivKartice?: string
    clientEmail: string
    clientName: string
    ovlascenoIme?: string
    ovlascenoPrezime?: string
    ovlascenoEmail?: string
    ovlascenoBrojTelefona?: string
  }) => clientApi.post<CardRequestResponse>('/cards/request', payload),

  verifyCardRequest: (requestId: number, code: string) =>
    clientApi.post<CardVerifyResponse>(`/cards/request/${requestId}/verify`, { code }),
}

// Employee-facing card API (uses employee JWT)
export const employeeCardApi = {
  listByAccount: (accountId: number | string) =>
    api.get<Card[]>(`/cards/account/${accountId}`),

  createCard: (payload: {
    accountId: number
    clientId: number
    vrstaKartice: string
    nazivKartice?: string
    clientEmail?: string
    clientName?: string
  }) => api.post<Card>('/cards', payload),

  blockCard: (cardId: number, clientId: number) =>
    api.put<Card>(`/cards/${cardId}/block`, { clientId }),

  unblockCard: (cardId: number) =>
    api.put<Card>(`/cards/${cardId}/unblock`),

  deactivateCard: (cardId: number) =>
    api.put<Card>(`/cards/${cardId}/deactivate`),
}
