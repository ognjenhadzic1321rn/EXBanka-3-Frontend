import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CreateAccountView from '../../views/CreateAccountView.vue'
import { useAccountStore } from '../../stores/account'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/account', () => ({
  accountApi: { create: vi.fn() },
  CURRENCIES: [
    { id: 1, kod: 'RSD', naziv: 'Serbian Dinar' },
    { id: 2, kod: 'EUR', naziv: 'Euro' },
    { id: 3, kod: 'USD', naziv: 'US Dollar' },
  ],
}))

vi.mock('../../components/ClientSelectDialog.vue', () => ({
  default: { template: '<div class="mock-client-dialog" />' },
}))

vi.mock('../../api/clientManagement', () => ({
  clientManagementApi: { list: vi.fn(), get: vi.fn(), update: vi.fn(), create: vi.fn() },
}))

describe('CreateAccountView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the form with all required sections', () => {
    const wrapper = mount(CreateAccountView)

    expect(wrapper.text()).toContain('Kreiranje računa')
    expect(wrapper.text()).toContain('Valuta')
    expect(wrapper.text()).toContain('Tip računa')
    expect(wrapper.text()).toContain('Vrsta')
  })

  it('renders currency dropdown with options', () => {
    const wrapper = mount(CreateAccountView)
    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.length).toBeGreaterThanOrEqual(3)
  })

  it('renders tekuci and devizni radio buttons', () => {
    const wrapper = mount(CreateAccountView)
    const radios = wrapper.findAll('input[type="radio"]')
    const values = radios.map(r => r.element.value)
    expect(values).toContain('tekuci')
    expect(values).toContain('devizni')
  })

  it('renders licni and poslovni radio buttons', () => {
    const wrapper = mount(CreateAccountView)
    const radios = wrapper.findAll('input[type="radio"]')
    const values = radios.map(r => r.element.value)
    expect(values).toContain('licni')
    expect(values).toContain('poslovni')
  })

  it('shows firma ID input when poslovni is selected', async () => {
    const wrapper = mount(CreateAccountView)

    const poslovniRadio = wrapper.findAll('input[type="radio"]').find(r => r.element.value === 'poslovni')
    await poslovniRadio!.setValue('poslovni')
    await poslovniRadio!.trigger('change')

    expect(wrapper.text()).toContain('Naziv firme')
    expect(wrapper.find('input[placeholder="npr. Firma DOO"]').exists()).toBe(true)
  })

  it('does not show firma form when licni is selected', () => {
    const wrapper = mount(CreateAccountView)
    expect(wrapper.find('input[placeholder="npr. Firma DOO"]').exists()).toBe(false)
  })

  it('renders disabled card checkbox (Sprint 2 guardrail)', () => {
    const wrapper = mount(CreateAccountView)
    const cardCheckbox = wrapper.find('#card-checkbox')
    expect(cardCheckbox.exists()).toBe(true)
    expect((cardCheckbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('shows error when submitting without a client selected', async () => {
    const wrapper = mount(CreateAccountView)
    const store = useAccountStore()

    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(store.error).toContain('klijenta')
  })

  it('opens ClientSelectDialog when Select Client button clicked', async () => {
    const wrapper = mount(CreateAccountView)

    await wrapper.find('button[class*="btn-secondary"]').trigger('click')

    expect(wrapper.find('.mock-client-dialog').exists()).toBe(true)
  })

  it('calls store.createAccount and redirects on success', async () => {
    const store = useAccountStore()
    const createSpy = vi.spyOn(store, 'createAccount').mockResolvedValueOnce({
      id: '99', brojRacuna: '111111111111111111', clientId: '1', firmaId: '0',
      currencyId: '2', currencyKod: 'EUR', tip: 'tekuci', vrsta: 'licni',
      stanje: 0, raspolozivoStanje: 0, dnevniLimit: 100000, mesecniLimit: 1000000,
      naziv: '', status: 'aktivan',
    })

    const wrapper = mount(CreateAccountView)

    // Simulate client selection via component internals
    wrapper.vm.selectedClientId = '1'
    wrapper.vm.selectedClientLabel = 'Ana Jović'
    await wrapper.vm.$nextTick()

    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(createSpy).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/accounts')
  })
})
