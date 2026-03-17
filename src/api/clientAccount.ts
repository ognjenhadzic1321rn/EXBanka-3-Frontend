import clientApi from './clientAuth'

export interface ClientAccountItem {
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

export const clientAccountApi = {
  listByClient: (clientId: string) =>
    clientApi.get(`/accounts/client/${clientId}`),

  get: (id: string) =>
    clientApi.get(`/accounts/${id}`),
}
