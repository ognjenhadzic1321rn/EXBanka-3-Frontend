import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientAccountsView from '../../views/client/ClientAccountsView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/clientAccount', () => ({
  clientAccountApi: { listByClient: vi.fn(), get: vi.fn() },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

vi.mock('../../api/transfer', () => ({
  transferApi: { listByClient: vi.fn().mockResolvedValue({ data: { transfers: [], total: 0 } }) },
}))

import { clientAccountApi } from '../../api/clientAccount'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '5', firmaId: '0',
    currencyId: '2', currencyKod: 'EUR', tip: 'tekuci', vrsta: 'licni',
    stanje: 5000, raspolozivoStanje: 4500, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'My EUR account', status: 'aktivan',
  },
  {
    id: '2', brojRacuna: '222222222222222222', clientId: '5', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'tekuci', vrsta: 'licni',
    stanje: 50000, raspolozivoStanje: 50000, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: '', status: 'aktivan',
  },
]

describe('ClientAccountsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(clientAccountApi.listByClient).mockResolvedValue({
      data: { accounts: mockAccounts },
    })
  })

  it('renders Računi heading', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Računi')
  })

  it('calls fetchAccounts with client id on mount', async () => {
    mount(ClientAccountsView)
    await flushPromises()
    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('5')
  })

  it('renders a card for each active account', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    const cards = wrapper.findAll('.card')
    expect(cards.length).toBeGreaterThanOrEqual(2)
  })

  it('shows account number on each card', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('222222222222222222')
  })

  it('shows Raspoloživo stanje label and currency', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Raspoloživo stanje')
    expect(wrapper.text()).toContain('EUR')
  })

  it('shows Dnevna and Mesečna potrošnja in detail modal', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    const detaljBtn = wrapper.findAll('button').find(b => b.text() === 'Detalji')
    await detaljBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Dnevna potrošnja')
    expect(wrapper.text()).toContain('Mesečna potrošnja')
  })

  it('shows both active accounts in the list', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    // Both accounts have status: 'aktivan' and appear in the list
    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('222222222222222222')
  })

  it('shows Detalji button for each account', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    const detaljBtns = wrapper.findAll('button').filter(b => b.text() === 'Detalji')
    expect(detaljBtns.length).toBe(2)
  })

  it('clicking Detalji opens account detail modal', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    const detaljBtn = wrapper.findAll('button').find(b => b.text() === 'Detalji')
    await detaljBtn!.trigger('click')

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Novo plaćanje')
  })

  it('clicking Novo plaćanje in modal navigates to /client/payments/new', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    const detaljBtn = wrapper.findAll('button').find(b => b.text() === 'Detalji')
    await detaljBtn!.trigger('click')

    const payBtn = wrapper.findAll('button').find(b => b.text() === 'Novo plaćanje')
    await payBtn!.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/client/payments/new')
  })

  it('shows empty state when no accounts', async () => {
    vi.mocked(clientAccountApi.listByClient).mockResolvedValueOnce({ data: { accounts: [] } })

    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nema aktivnih računa')
  })
})
