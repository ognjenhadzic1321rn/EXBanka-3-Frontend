import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientRecipientsView from '../../views/client/ClientRecipientsView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

vi.mock('../../api/recipient', () => ({
  recipientApi: {
    listByClient: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

import { recipientApi } from '../../api/recipient'

const mockRecipients = [
  { id: '1', clientId: '5', naziv: 'Ana Jović', brojRacuna: '111111111111111111' },
  { id: '2', clientId: '5', naziv: 'EPS', brojRacuna: '222222222222222222' },
]

describe('ClientRecipientsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(recipientApi.listByClient).mockResolvedValue({
      data: { recipients: mockRecipients },
    })
  })

  it('renders Primaoci plaćanja heading', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Primaoci plaćanja')
  })

  it('loads recipients on mount', async () => {
    mount(ClientRecipientsView)
    await flushPromises()
    expect(recipientApi.listByClient).toHaveBeenCalledWith('5')
  })

  it('shows recipient rows in table', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()
    const rows = wrapper.findAll('.rcp-card')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('Ana Jović')
    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('EPS')
  })

  it('shows empty state when no recipients', async () => {
    vi.mocked(recipientApi.listByClient).mockResolvedValueOnce({ data: { recipients: [] } })
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()
    expect(wrapper.text()).toContain('Nema sačuvanih primalaca')
  })

  it('clicking Dodaj primaoca opens modal', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    expect(wrapper.find('.rcp-overlay').exists()).toBe(false)
    await wrapper.findAll('button').find(b => b.text().includes('Dodaj'))!.trigger('click')
    expect(wrapper.find('.rcp-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Novi primalac')
  })

  it('modal close button hides the modal', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Dodaj'))!.trigger('click')
    expect(wrapper.find('.rcp-overlay').exists()).toBe(true)

    await wrapper.find('.rcp-modal-close').trigger('click')
    expect(wrapper.find('.rcp-overlay').exists()).toBe(false)
  })

  it('save with empty fields shows validation error', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Dodaj'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi')!.trigger('click')

    expect(wrapper.text()).toContain('obavezni')
    expect(recipientApi.create).not.toHaveBeenCalled()
  })

  it('save with valid data calls create API and closes modal', async () => {
    vi.mocked(recipientApi.create).mockResolvedValueOnce({
      data: { recipient: { id: '3', clientId: '5', naziv: 'Novi', brojRacuna: '333333333333333333' } },
    })

    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text().includes('Dodaj'))!.trigger('click')

    const inputs = wrapper.findAll('.rcp-modal input')
    await inputs[0].setValue('Novi')
    await inputs[1].setValue('333333333333333333')

    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi')!.trigger('click')
    await flushPromises()

    expect(recipientApi.create).toHaveBeenCalledWith('5', 'Novi', '333333333333333333')
    expect(wrapper.find('.rcp-overlay').exists()).toBe(false)
  })

  it('clicking Izmeni opens modal pre-filled with recipient data', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    const editBtns = wrapper.findAll('button').filter(b => b.text() === 'Izmeni')
    await editBtns[0].trigger('click')

    expect(wrapper.text()).toContain('Izmeni primaoca')
    const inputs = wrapper.findAll('.rcp-modal input')
    expect((inputs[0].element as HTMLInputElement).value).toBe('Ana Jović')
    expect((inputs[1].element as HTMLInputElement).value).toBe('111111111111111111')
  })

  it('save in edit mode calls update API', async () => {
    vi.mocked(recipientApi.update).mockResolvedValueOnce({
      data: { recipient: { id: '1', clientId: '5', naziv: 'Ana Izmenjeno', brojRacuna: '111111111111111111' } },
    })

    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    const editBtns = wrapper.findAll('button').filter(b => b.text() === 'Izmeni')
    await editBtns[0].trigger('click')

    const inputs = wrapper.findAll('.rcp-modal input')
    await inputs[0].setValue('Ana Izmenjeno')

    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi')!.trigger('click')
    await flushPromises()

    expect(recipientApi.update).toHaveBeenCalledWith('1', 'Ana Izmenjeno', '111111111111111111')
    expect(wrapper.find('.rcp-overlay').exists()).toBe(false)
  })

  it('clicking Obriši opens delete confirmation', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    const deleteBtns = wrapper.findAll('button').filter(b => b.text() === 'Obriši')
    await deleteBtns[0].trigger('click')

    expect(wrapper.text()).toContain('Obriši primaoca')
    expect(wrapper.text()).toContain('ne može poništiti')
  })

  it('confirming delete calls delete API', async () => {
    vi.mocked(recipientApi.delete).mockResolvedValueOnce({})

    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    const deleteBtns = wrapper.findAll('button').filter(b => b.text() === 'Obriši')
    await deleteBtns[0].trigger('click')

    // The confirm modal's Obriši button does not have btn-sm (unlike row buttons)
    const confirmBtn = wrapper.findAll('button').find(
      b => b.classes('rcp-btn-danger') && b.text().includes('Obriši')
    )
    await confirmBtn!.trigger('click')
    await flushPromises()

    expect(recipientApi.delete).toHaveBeenCalledWith('1')
  })

  it('cancel delete closes confirmation without calling API', async () => {
    const wrapper = mount(ClientRecipientsView)
    await flushPromises()

    const deleteBtns = wrapper.findAll('button').filter(b => b.text() === 'Obriši')
    await deleteBtns[0].trigger('click')

    await wrapper.findAll('button').find(b => b.text() === 'Otkaži')!.trigger('click')

    expect(wrapper.text()).not.toContain('Potvrda brisanja')
    expect(recipientApi.delete).not.toHaveBeenCalled()
  })
})
