import clientApi from './clientAuth'

export interface Loan {
  id: number
  vrsta: string
  broj_racuna: string
  broj_kredita: string
  iznos: number
  period: number
  kamatna_stopa: number
  tip_kamate: string
  datum_kreiranja: string
  datum_dospeca: string
  iznos_rate: number
  status: string
  client_id: number
  zaposleni_id: number | null
  currency_id: number
  svrha_kredita: string
  iznos_mesecne_plate: number
  status_zaposlenja: string
  period_zaposlenja: string
  kontakt_telefon: string
  created_at: string
}

export interface LoanInstallment {
  id: number
  loan_id: number
  redni_broj: number
  iznos: number
  kamata_stopa_snapshot: number
  datum_dospeca: string
  datum_placanja: string | null
  status: string
}

export interface CreateLoanPayload {
  vrsta: string
  brojRacuna: string
  iznos: number
  period: number
  tipKamate: string
  clientId: number
  currencyId: number
  svrhaKredita: string
  iznosMesecnePlate: number
  statusZaposlenja: string
  periodZaposlenja: string
  kontaktTelefon: string
}

export const EMPLOYMENT_STATUSES = [
  { value: 'stalno', label: 'Stalno zaposlenje' },
  { value: 'privremeno', label: 'Privremeno zaposlenje' },
  { value: 'nezaposlen', label: 'Nezaposlen' },
]

export const PERIOD_OPTIONS: Record<string, number[]> = {
  gotovinski:      [12, 24, 36, 48, 60, 72, 84],
  auto:            [12, 24, 36, 48, 60, 72, 84],
  studentski:      [12, 24, 36, 48, 60, 72, 84],
  refinansirajuci: [12, 24, 36, 48, 60, 72, 84],
  stambeni:        [60, 120, 180, 240, 300, 360],
}

export const LOAN_TYPES = [
  { value: 'gotovinski', label: 'Gotovinski' },
  { value: 'stambeni',   label: 'Stambeni' },
  { value: 'auto',       label: 'Auto' },
  { value: 'refinansirajuci', label: 'Refinansirajući' },
  { value: 'studentski', label: 'Studentski' },
]

export const INTEREST_TYPES = [
  { value: 'fiksna',      label: 'Fiksna' },
  { value: 'varijabilna', label: 'Varijabilna' },
]

export const LOAN_STATUS_LABELS: Record<string, string> = {
  zahtev:   'Zahtev',
  odobren:  'Odobren',
  odbijen:  'Odbijen',
  aktivan:  'Aktivan',
  zatvoren: 'Zatvoren',
}

// Annuity formula matching loan-service/internal/service/loan_service.go
export function calculateInstallment(amount: number, annualRate: number, months: number): number {
  if (months <= 0 || amount <= 0) return 0
  const r = annualRate / 12 / 100
  if (r === 0) return amount / months
  const factor = Math.pow(1 + r, months)
  return (amount * r * factor) / (factor - 1)
}

// Base interest rate table (must match Go service)
export function baseInterestRate(amountRSD: number, tipKamate: string): number {
  const bands = [
    { limit: 100_000,    fiksna: 6.50, varijabilna: 4.50 },
    { limit: 500_000,    fiksna: 5.80, varijabilna: 3.80 },
    { limit: 1_000_000,  fiksna: 5.20, varijabilna: 3.20 },
    { limit: 5_000_000,  fiksna: 4.50, varijabilna: 2.50 },
    { limit: Infinity,   fiksna: 4.00, varijabilna: 2.00 },
  ]
  for (const b of bands) {
    if (amountRSD <= b.limit) {
      return tipKamate === 'fiksna' ? b.fiksna : b.varijabilna
    }
  }
  return 4.00
}

export function marginForVrsta(vrsta: string): number {
  const margins: Record<string, number> = {
    gotovinski:     1.5,
    stambeni:       0.0,
    auto:           0.5,
    refinansirajuci: 0.0,
    studentski:     -0.5,
  }
  return margins[vrsta] ?? 0
}

export const loanApi = {
  create: (data: CreateLoanPayload) =>
    clientApi.post('/loans/request', {
      vrsta:                data.vrsta,
      broj_racuna:          data.brojRacuna,
      iznos:                data.iznos,
      period:               data.period,
      tip_kamate:           data.tipKamate,
      client_id:            data.clientId,
      currency_id:          data.currencyId,
      euribor_rate:         0,
      svrha_kredita:        data.svrhaKredita,
      iznos_mesecne_plate:  data.iznosMesecnePlate,
      status_zaposlenja:    data.statusZaposlenja,
      period_zaposlenja:    data.periodZaposlenja,
      kontakt_telefon:      data.kontaktTelefon,
    }),

  listByClient: (clientId: string | number) =>
    clientApi.get(`/loans/client/${clientId}`),

  get: (id: number | string) =>
    clientApi.get(`/loans/${id}`),

  listInstallments: (id: number | string) =>
    clientApi.get(`/loans/${id}/installments`),
}
