import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientAccountsView from '../../views/client/ClientAccountsView.vue'
import { useClientAccountStore } from '../../stores/clientAccount'
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
    naziv: '', status: 'blokiran',
  },
]

describe('ClientAccountsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Set up logged-in client
    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(clientAccountApi.listByClient).mockResolvedValue({
      data: { accounts: mockAccounts },
    })
  })

  it('renders My Accounts heading', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('My Accounts')
  })

  it('calls fetchAccounts with client id on mount', async () => {
    mount(ClientAccountsView)
    await flushPromises()
    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('5')
  })

  it('renders an account card for each account', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    const cards = wrapper.findAll('.account-card')
    expect(cards).toHaveLength(2)
  })

  it('shows account number on each card', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('222222222222222222')
  })

  it('shows balance and available balance', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Balance')
    expect(wrapper.text()).toContain('Available')
    expect(wrapper.text()).toContain('EUR')
  })

  it('shows daily and monthly limits', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Daily limit')
    expect(wrapper.text()).toContain('Monthly limit')
  })

  it('shows account status badge', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('aktivan')
    expect(wrapper.text()).toContain('blokiran')
  })

  it('shows New Transfer and New Payment buttons', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()
    expect(wrapper.text()).toContain('New Transfer')
    expect(wrapper.text()).toContain('New Payment')
  })

  it('clicking New Transfer navigates with fromAccountId', async () => {
    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    const transferBtn = wrapper.findAll('button').find(b => b.text() === 'New Transfer')
    await transferBtn!.trigger('click')

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/client/transfers', query: expect.objectContaining({ fromAccountId: '1' }) })
    )
  })

  it('shows empty state when no accounts', async () => {
    vi.mocked(clientAccountApi.listByClient).mockResolvedValueOnce({ data: { accounts: [] } })

    const wrapper = mount(ClientAccountsView)
    await flushPromises()

    expect(wrapper.text()).toContain('No accounts found')
  })
})
