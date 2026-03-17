import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientDashboardView from '../../views/client/ClientDashboardView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

vi.mock('../../api/exchange', () => ({
  exchangeApi: { getRates: vi.fn(), calculate: vi.fn() },
}))

vi.mock('../../api/payment', () => ({
  paymentApi: { create: vi.fn(), verify: vi.fn(), listByClient: vi.fn(), listByAccount: vi.fn(), get: vi.fn() },
  SIFRE_PLACANJA: [],
}))

vi.mock('../../api/clientAccount', () => ({
  clientAccountApi: { listByClient: vi.fn(), get: vi.fn() },
}))

vi.mock('../../api/transfer', () => ({
  transferApi: { create: vi.fn(), listByClient: vi.fn(), listByAccount: vi.fn(), calculateExchange: vi.fn() },
}))

vi.mock('../../api/recipient', () => ({
  recipientApi: { listByClient: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

import { exchangeApi } from '../../api/exchange'
import { paymentApi } from '../../api/payment'
import { clientAccountApi } from '../../api/clientAccount'
import { transferApi } from '../../api/transfer'
import { recipientApi } from '../../api/recipient'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '5', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'tekuci', vrsta: 'licni',
    stanje: 50000, raspolozivoStanje: 50000, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'RSD račun', status: 'aktivan',
  },
  {
    id: '2', brojRacuna: '222222222222222222', clientId: '5', firmaId: '0',
    currencyId: '2', currencyKod: 'EUR', tip: 'devizni', vrsta: 'licni',
    stanje: 500, raspolozivoStanje: 450, dnevniLimit: 10000, mesecniLimit: 100000,
    naziv: 'EUR račun', status: 'aktivan',
  },
]

const mockTransfers = [
  {
    id: 't1', racunPosiljaocaId: '1', racunPrimaocaId: '2',
    iznos: 1000, valutaIznosa: 'RSD', konvertovaniIznos: 1000, kurs: 1,
    svrha: 'Kirija', status: 'uspesno', vremeTransakcije: '2026-03-01T10:00:00Z',
  },
]

const mockPayments = [
  {
    id: 'p1', racunPosiljaocaId: '1', racunPrimaocaBroj: '999999999999999999',
    iznos: 1200, sifraPlacanja: '240', pozivNaBroj: '', svrha: 'Struja',
    status: 'u_obradi', vremeTransakcije: '2026-03-02T12:00:00Z',
  },
]

const mockRates = [
  { from: 'EUR', to: 'RSD', rate: 117.5 },
  { from: 'USD', to: 'RSD', rate: 108.8 },
]

const mockRecipients = [
  { id: '10', clientId: '5', naziv: 'EPS', brojRacuna: '999999999999999999' },
  { id: '11', clientId: '5', naziv: 'Telenor', brojRacuna: '888888888888888888' },
]

describe('ClientDashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(clientAccountApi.listByClient).mockResolvedValue({ data: { accounts: mockAccounts } })
    vi.mocked(transferApi.listByClient).mockResolvedValue({ data: { transfers: mockTransfers, total: 1 } })
    vi.mocked(paymentApi.listByClient).mockResolvedValue({ data: { payments: mockPayments, total: 1 } })
    vi.mocked(exchangeApi.getRates).mockResolvedValue({ data: { rates: mockRates } })
    vi.mocked(recipientApi.listByClient).mockResolvedValue({ data: { recipients: mockRecipients } })
  })

  // Section 1: Accounts
  it('renders welcome heading with client name', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Dobrodošli')
    expect(wrapper.text()).toContain('Ana')
  })

  it('renders Moji računi section', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Moji računi')
  })

  it('shows account summary cards for each account', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    const cards = wrapper.findAll('.account-summary-card')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('RSD račun')
    expect(wrapper.text()).toContain('EUR račun')
  })

  it('shows account balance in cards', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('50.000')
    expect(wrapper.text()).toContain('500')
  })

  // Section 2: Recent transactions
  it('renders Poslednje transakcije section', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Poslednje transakcije')
  })

  it('shows combined recent transfers and payments', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    const rows = wrapper.findAll('.activity-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('Kirija')
    expect(wrapper.text()).toContain('Struja')
  })

  // Section 3: Exchange rates
  it('renders Kursna lista section', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Kursna lista')
  })

  it('loads and displays exchange rates', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    const rows = wrapper.findAll('.rate-row')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('EUR/RSD')
    expect(wrapper.text()).toContain('117.5000')
  })

  // Section 4: Quick payment
  it('renders Brzo plaćanje section', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Brzo plaćanje')
  })

  it('quick payment form shows account and recipient dropdowns', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('EPS')
    expect(wrapper.text()).toContain('RSD račun')
  })

  it('quick payment submit with empty fields shows error', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()

    const platiBtn = wrapper.findAll('button').find(b => b.text() === 'Plati')
    await platiBtn!.trigger('click')
    expect(wrapper.text()).toContain('Izaberite račun')
  })

  it('quick payment submit creates payment and moves to verify step', async () => {
    vi.mocked(paymentApi.create).mockResolvedValueOnce({
      data: { payment: { id: 'p99', status: 'u_obradi', iznos: 500, svrha: 'Brzo plaćanje',
        racunPosiljaocaId: '1', racunPrimaocaBroj: '999999999999999999',
        sifraPlacanja: '289', pozivNaBroj: '', verifikacioniKod: '654321',
        vremeTransakcije: '2026-03-10T10:00:00Z' } },
    })

    const wrapper = mount(ClientDashboardView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    const fromSelect = selects.find(s => s.text().includes('Račun'))
    const recipientSelect = selects.find(s => s.text().includes('Primalac'))
    await fromSelect!.setValue('1')
    await recipientSelect!.setValue('10')
    await wrapper.find('input[type="number"]').setValue('500')

    await wrapper.findAll('button').find(b => b.text() === 'Plati')!.trigger('click')
    await flushPromises()

    expect(paymentApi.create).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('verifikacioni kod')
  })

  it('quick payment verify with correct code shows success', async () => {
    vi.mocked(paymentApi.create).mockResolvedValueOnce({
      data: { payment: { id: 'p99', status: 'u_obradi', iznos: 500, svrha: 'Brzo plaćanje',
        racunPosiljaocaId: '1', racunPrimaocaBroj: '999999999999999999',
        sifraPlacanja: '289', pozivNaBroj: '', verifikacioniKod: '654321',
        vremeTransakcije: '2026-03-10T10:00:00Z' } },
    })
    vi.mocked(paymentApi.verify).mockResolvedValueOnce({
      data: { payment: { id: 'p99', status: 'uspesno' } },
    })

    const wrapper = mount(ClientDashboardView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects.find(s => s.text().includes('Račun'))!.setValue('1')
    await selects.find(s => s.text().includes('Primalac'))!.setValue('10')
    await wrapper.find('input[type="number"]').setValue('500')
    await wrapper.findAll('button').find(b => b.text() === 'Plati')!.trigger('click')
    await flushPromises()

    await wrapper.find('input[maxlength="6"]').setValue('654321')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Plaćanje uspešno')
  })

  it('quick payment reset after success returns to form', async () => {
    vi.mocked(paymentApi.create).mockResolvedValueOnce({
      data: { payment: { id: 'p99', status: 'u_obradi', iznos: 500, svrha: 'Brzo plaćanje',
        racunPosiljaocaId: '1', racunPrimaocaBroj: '999999999999999999',
        sifraPlacanja: '289', pozivNaBroj: '', vremeTransakcije: '2026-03-10T10:00:00Z' } },
    })
    vi.mocked(paymentApi.verify).mockResolvedValueOnce({
      data: { payment: { id: 'p99', status: 'uspesno' } },
    })

    const wrapper = mount(ClientDashboardView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects.find(s => s.text().includes('Račun'))!.setValue('1')
    await selects.find(s => s.text().includes('Primalac'))!.setValue('10')
    await wrapper.find('input[type="number"]').setValue('500')
    await wrapper.findAll('button').find(b => b.text() === 'Plati')!.trigger('click')
    await flushPromises()
    await wrapper.find('input[maxlength="6"]').setValue('654321')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi')!.trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Novo plaćanje')!.trigger('click')
    expect(wrapper.text()).toContain('Plati')
  })

  // Section 5: Recipients
  it('renders Primaoci section with top recipients', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Primaoci')
    const items = wrapper.findAll('.recipient-item')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('EPS')
    expect(wrapper.text()).toContain('Telenor')
  })

  // Section 6: Notifications
  it('renders Obaveštenja section', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    expect(wrapper.text()).toContain('Obaveštenja')
  })

  it('shows notification items derived from recent activity', async () => {
    const wrapper = mount(ClientDashboardView)
    await flushPromises()
    const items = wrapper.findAll('.notification-item')
    expect(items.length).toBeGreaterThan(0)
  })

  it('loads all data on mount', async () => {
    mount(ClientDashboardView)
    await flushPromises()
    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('5')
    expect(transferApi.listByClient).toHaveBeenCalled()
    expect(paymentApi.listByClient).toHaveBeenCalled()
    expect(exchangeApi.getRates).toHaveBeenCalled()
    expect(recipientApi.listByClient).toHaveBeenCalledWith('5')
  })
})
