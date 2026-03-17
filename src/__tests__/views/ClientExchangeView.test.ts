import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientExchangeView from '../../views/client/ClientExchangeView.vue'

vi.mock('../../api/exchange', () => ({
  exchangeApi: {
    getRates: vi.fn(),
    calculate: vi.fn(),
  },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

import { exchangeApi } from '../../api/exchange'

const mockRates = [
  { from: 'EUR', to: 'RSD', rate: 117.5 },
  { from: 'EUR', to: 'USD', rate: 1.08 },
  { from: 'USD', to: 'RSD', rate: 108.8 },
  { from: 'USD', to: 'EUR', rate: 0.926 },
]

describe('ClientExchangeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    vi.mocked(exchangeApi.getRates).mockResolvedValue({
      data: { rates: mockRates },
    })
  })

  it('renders Menjačnica heading', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Menjačnica')
  })

  it('renders Kursna lista section', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Kursna lista')
  })

  it('loads rates on mount', async () => {
    mount(ClientExchangeView)
    await flushPromises()
    expect(exchangeApi.getRates).toHaveBeenCalledOnce()
  })

  it('displays all currency pairs in rate table', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
  })

  it('shows from, to and rate in table', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('EUR')
    expect(wrapper.text()).toContain('RSD')
    expect(wrapper.text()).toContain('117.5000')
  })

  it('shows inverse rate column', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    // inverse of 117.5 = 0.0085...
    expect(wrapper.text()).toContain('Inverzni kurs')
    expect(wrapper.text()).toContain('0.0085')
  })

  it('shows empty state when no rates returned', async () => {
    vi.mocked(exchangeApi.getRates).mockResolvedValueOnce({ data: { rates: [] } })
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Nema dostupnih kurseva')
  })

  it('shows error when rates fetch fails', async () => {
    vi.mocked(exchangeApi.getRates).mockRejectedValueOnce({
      response: { data: { message: 'Service unavailable' } },
    })
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Service unavailable')
  })

  it('renders Kalkulator konverzije section', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    expect(wrapper.text()).toContain('Kalkulator konverzije')
  })

  it('renders currency dropdowns with all 8 currencies', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    // Each select has 8 currency options
    expect(selects[0].findAll('option')).toHaveLength(8)
    expect(selects[1].findAll('option')).toHaveLength(8)
  })

  it('Izračunaj button is disabled when amount is empty', async () => {
    const wrapper = mount(ClientExchangeView)
    await flushPromises()
    const btn = wrapper.findAll('button').find(b => b.text().includes('Izračunaj'))
    expect(btn!.attributes('disabled')).toBeDefined()
  })

  it('calls calculate API and shows result', async () => {
    vi.mocked(exchangeApi.calculate).mockResolvedValueOnce({
      data: { output_amount: 11750, rate: 117.5 },
    })

    const wrapper = mount(ClientExchangeView)
    await flushPromises()

    const amountInput = wrapper.find('input[type="number"]')
    await amountInput.setValue('100')

    const btn = wrapper.findAll('button').find(b => b.text().includes('Izračunaj'))
    await btn!.trigger('click')
    await flushPromises()

    expect(exchangeApi.calculate).toHaveBeenCalledWith('EUR', 'RSD', 100)
    expect(wrapper.text()).toContain('11.750')
  })

  it('shows calc error when API fails', async () => {
    vi.mocked(exchangeApi.calculate).mockRejectedValueOnce({
      response: { data: { message: 'Calculation error' } },
    })

    const wrapper = mount(ClientExchangeView)
    await flushPromises()

    const amountInput = wrapper.find('input[type="number"]')
    await amountInput.setValue('50')

    const btn = wrapper.findAll('button').find(b => b.text().includes('Izračunaj'))
    await btn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Calculation error')
  })
})
