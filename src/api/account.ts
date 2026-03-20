import api from './client'

// Static currency list matching seed order (INFRA-BE-2)
export const CURRENCIES = [
  { id: 1, kod: 'RSD', naziv: 'Serbian Dinar' },
  { id: 2, kod: 'EUR', naziv: 'Euro' },
  { id: 3, kod: 'USD', naziv: 'US Dollar' },
  { id: 4, kod: 'CHF', naziv: 'Swiss Franc' },
  { id: 5, kod: 'GBP', naziv: 'British Pound' },
  { id: 6, kod: 'JPY', naziv: 'Japanese Yen' },
  { id: 7, kod: 'CAD', naziv: 'Canadian Dollar' },
  { id: 8, kod: 'AUD', naziv: 'Australian Dollar' },
]

export interface CreateAccountPayload {
  clientId: number
  firmaId?: number
  currencyId: number
  tip: string   // 'tekuci' | 'devizni'
  vrsta: string // 'licni' | 'poslovni'
  naziv?: string
  pocetnoStanje?: number
}

export interface AccountProto {
  id: string
  brojRacuna: string
  clientId: string
  firmaId: string
  currencyId: string
  currencyKod: string
  tip: string
  vrsta: string
  stanje: number
  raspolozivoStanje: number
  dnevniLimit: number
  mesecniLimit: number
  naziv: string
  status: string
}

export const accountApi = {
  create: (data: CreateAccountPayload) =>
    api.post('/accounts/create', {
      clientId:      data.clientId,
      firmaId:       data.firmaId ?? 0,
      currencyId:    data.currencyId,
      tip:           data.tip,
      vrsta:         data.vrsta,
      naziv:         data.naziv ?? '',
      pocetnoStanje: data.pocetnoStanje ?? 0,
    }),

  get: (id: string) => api.get(`/accounts/${id}`),

  listByClient: (clientId: string) => api.get(`/accounts/client/${clientId}`),

  listAll: (params: {
    clientName?: string
    tip?: string
    vrsta?: string
    status?: string
    currencyId?: number
    page?: number
    pageSize?: number
  }) => api.get('/accounts', { params: {
    client_name:  params.clientName,
    tip:          params.tip,
    vrsta:        params.vrsta,
    status:       params.status,
    currency_id:  params.currencyId,
    page:         params.page,
    page_size:    params.pageSize,
  }}),

  updateName: (id: string, naziv: string) =>
    api.put(`/accounts/${id}/name`, { naziv }),

  updateLimits: (id: string, dnevniLimit: number, mesecniLimit: number) =>
    api.put(`/accounts/${id}/limits`, { dnevni_limit: dnevniLimit, mesecni_limit: mesecniLimit }),
}
