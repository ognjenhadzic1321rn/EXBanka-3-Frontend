import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientPaymentsView from '../../views/client/ClientPaymentsView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/payment', () => ({
  paymentApi: {
    create: vi.fn(),
    verify: vi.fn(),
    listByClient: vi.fn(),
    listByAccount: vi.fn(),
    get: vi.fn(),
  },
  SIFRE_PLACANJA: [],
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

vi.mock('jspdf', () => {
  const mockSave = vi.fn()
  const mockDoc = {
    setFont: vi.fn().mockReturnThis(),
    setFontSize: vi.fn().mockReturnThis(),
    setTextColor: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(),
    line: vi.fn().mockReturnThis(),
    save: mockSave,
  }
  return { default: vi.fn(() => mockDoc), __mockSave: mockSave }
})

import { paymentApi } from '../../api/payment'

const mockPayments = [
  {
    id: '1',
    racunPosiljaocaId: '10',
    racunPrimaocaBroj: '111111111111111111',
    iznos: 5000,
    sifraPlacanja: '289',
    pozivNaBroj: '97-123',
    svrha: 'Kirija',
    status: 'uspesno',
    vremeTransakcije: '2026-03-01T10:00:00Z',
  },
  {
    id: '2',
    racunPosiljaocaId: '10',
    racunPrimaocaBroj: '222222222222222222',
    iznos: 1200,
    sifraPlacanja: '240',
    pozivNaBroj: '',
    svrha: 'Struja',
    status: 'u_obradi',
    vremeTransakcije: '2026-03-02T12:00:00Z',
  },
  {
    id: '3',
    racunPosiljaocaId: '10',
    racunPrimaocaBroj: '333333333333333333',
    iznos: 800,
    sifraPlacanja: '222',
    pozivNaBroj: '',
    svrha: 'Internet',
    status: 'stornirano',
    vremeTransakcije: '2026-03-03T08:00:00Z',
  },
]

describe('ClientPaymentsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(paymentApi.listByClient).mockResolvedValue({
      data: { payments: mockPayments, total: 3 },
    })
  })

  it('renders Plaćanja heading', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Plaćanja')
  })

  it('loads payments on mount', async () => {
    mount(ClientPaymentsView)
    await flushPromises()
    expect(paymentApi.listByClient).toHaveBeenCalledWith('5', expect.any(Object))
  })

  it('shows payment rows in table', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    const rows = wrapper.findAll('.payment-row')
    expect(rows).toHaveLength(3)
  })

  it('shows recipient account, amount and svrha', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('Kirija')
    expect(wrapper.text()).toContain('Struja')
  })

  it('shows status badges for each payment', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    expect(wrapper.text()).toContain('uspesno')
    expect(wrapper.text()).toContain('u_obradi')
    expect(wrapper.text()).toContain('stornirano')
  })

  it('uspesno badge has badge-success class', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    const badge = wrapper.findAll('.badge').find(b => b.text() === 'uspesno')
    expect(badge!.classes()).toContain('badge-success')
  })

  it('u_obradi badge has badge-warning class', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    const badge = wrapper.findAll('.badge').find(b => b.text() === 'u_obradi')
    expect(badge!.classes()).toContain('badge-warning')
  })

  it('stornirano badge has badge-neutral class', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    const badge = wrapper.findAll('.badge').find(b => b.text() === 'stornirano')
    expect(badge!.classes()).toContain('badge-neutral')
  })

  it('shows empty state when no payments', async () => {
    vi.mocked(paymentApi.listByClient).mockResolvedValueOnce({
      data: { payments: [], total: 0 },
    })
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Nema plaćanja')
  })

  it('clicking a row opens detail modal', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    await wrapper.find('.payment-row').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Detalji plaćanja')
  })

  it('detail modal shows all payment fields', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    await wrapper.find('.payment-row').trigger('click')

    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('Kirija')
    expect(wrapper.text()).toContain('97-123')
    expect(wrapper.text()).toContain('289')
  })

  it('modal close button hides modal', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    await wrapper.find('.payment-row').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    await wrapper.find('.modal-close').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('Novo plaćanje button navigates to /client/payments/new', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Novo plaćanje'))!.trigger('click')
    expect(mockPush).toHaveBeenCalledWith('/client/payments/new')
  })

  it('detail modal shows Stampaj potvrdu button', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    await wrapper.find('.pv-card').trigger('click')
    expect(wrapper.find('.pv-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Štampaj potvrdu')
  })

  it('shows filter dropdowns and date inputs', async () => {
    const wrapper = mount(ClientPaymentsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Svi statusi')
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(2)
  })

  it('changing status filter calls API with filter param', async () => {
    vi.mocked(paymentApi.listByClient).mockResolvedValue({
      data: { payments: [], total: 0 },
    })

    const wrapper = mount(ClientPaymentsView)
    await flushPromises()

    await wrapper.find('select').setValue('uspesno')
    await flushPromises()

    expect(paymentApi.listByClient).toHaveBeenCalledWith('5',
      expect.objectContaining({ status: 'uspesno' })
    )
  })
})
