import clientApi from './clientAuth'

export interface ExchangeRate {
  from: string
  to: string
  rate: number
}

export interface CalculateResult {
  fromCurrency: string
  toCurrency: string
  inputAmount: number
  outputAmount: number
  rate: number
}

export const exchangeApi = {
  getRates: () =>
    clientApi.get('/exchange/rates'),

  calculate: (fromCurrency: string, toCurrency: string, amount: number) =>
    clientApi.post('/exchange/calculate', {
      from_currency: fromCurrency,
      to_currency:   toCurrency,
      amount,
    }),
}
