import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountPortalView from '../../views/AccountPortalView.vue'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/account', () => ({
  accountApi: {
    create: vi.fn(),
    get: vi.fn(),
    listByClient: vi.fn(),
    listAll: vi.fn(),
    updateName: vi.fn(),
    updateLimits: vi.fn(),
  },
  CURRENCIES: [
    { id: 1, kod: 'RSD', naziv: 'Serbian Dinar' },
    { id: 2, kod: 'EUR', naziv: 'Euro' },
  ],
}))

vi.mock('../../api/clientManagement', () => ({
  clientManagementApi: {
    list: vi.fn().mockResolvedValue({ data: { clients: [], total: '0' } }),
    get: vi.fn(),
    update: vi.fn(),
    updatePermissions: vi.fn(),
  },
}))

vi.mock('../../api/card', () => ({
  employeeCardApi: {
    listByAccount: vi.fn().mockResolvedValue({ data: [] }),
    blockCard: vi.fn(),
    unblockCard: vi.fn(),
    deactivateCard: vi.fn(),
  },
  maskCardNumber: (n: string) => n,
  CARD_TYPE_LABELS: {} as Record<string, string>,
}))

import { accountApi } from '../../api/account'
import { employeeCardApi } from '../../api/card'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '10', firmaId: '0',
    currencyId: '2', currencyKod: 'EUR', tip: 'tekuci', vrsta: 'licni',
    stanje: 5000, raspolozivoStanje: 4500, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'My account', status: 'aktivan',
  },
  {
    id: '2', brojRacuna: '222222222222222222', clientId: '11', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'devizni', vrsta: 'poslovni',
    stanje: 100000, raspolozivoStanje: 100000, dnevniLimit: 500000, mesecniLimit: 5000000,
    naziv: '', status: 'blokiran',
  },
]

describe('AccountPortalView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(accountApi.listAll).mockResolvedValue({
      data: { accounts: mockAccounts, total: '2' },
    })
    vi.mocked(employeeCardApi.listByAccount).mockResolvedValue({ data: [] })
  })

  it('renders table with account column headers', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Broj računa')
    expect(wrapper.text()).toContain('Vrsta')
    expect(wrapper.text()).toContain('Tip')
  })

  it('renders account rows after fetch', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('222222222222222222')
    // Vrsta labels: Lični, Poslovni
    expect(wrapper.text()).toContain('Lični')
    expect(wrapper.text()).toContain('Poslovni')
  })

  it('calls fetchAllAccounts on mount', async () => {
    mount(AccountPortalView)
    await flushPromises()

    expect(accountApi.listAll).toHaveBeenCalledTimes(1)
  })

  it('renders filter inputs for name and account number', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('renders Novi račun button that navigates to /accounts/new', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    const btn = wrapper.findAll('button').find(b => b.text().includes('Novi račun'))
    await btn!.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/accounts/new')
  })

  it('shows Tip labels in table rows (Tekući / Devizni)', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('Tekući')
    expect(wrapper.text()).toContain('Devizni')
  })

  it('opens cards panel when a row is clicked', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.find('.panel-overlay').exists()).toBe(false)
    const rows = wrapper.findAll('tbody tr')
    await rows[0].trigger('click')
    await flushPromises()

    expect(wrapper.find('.panel-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Kartice računa')
  })

  it('shows no-cards message when account has no cards', async () => {
    vi.mocked(employeeCardApi.listByAccount).mockResolvedValueOnce({ data: [] })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Ovaj račun nema kartica')
  })

  it('closes panel when close button clicked', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.panel-overlay').exists()).toBe(true)

    await wrapper.find('.panel-close').trigger('click')
    expect(wrapper.find('.panel-overlay').exists()).toBe(false)
  })

  it('shows empty state when no accounts', async () => {
    vi.mocked(accountApi.listAll).mockResolvedValueOnce({
      data: { accounts: [], total: '0' },
    })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nema pronađenih računa')
  })
})
