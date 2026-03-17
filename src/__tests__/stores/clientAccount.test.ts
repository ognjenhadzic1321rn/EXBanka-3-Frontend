import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useClientAccountStore } from '../../stores/clientAccount'
import { clientAccountApi } from '../../api/clientAccount'

vi.mock('../../api/clientAccount', () => ({
  clientAccountApi: {
    listByClient: vi.fn(),
    get: vi.fn(),
  },
}))

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

describe('useClientAccountStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchAccounts sets accounts on success', async () => {
    vi.mocked(clientAccountApi.listByClient).mockResolvedValueOnce({
      data: { accounts: mockAccounts },
    })

    const store = useClientAccountStore()
    await store.fetchAccounts('5')

    expect(store.accounts).toHaveLength(2)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
  })

  it('fetchAccounts calls API with correct clientId', async () => {
    vi.mocked(clientAccountApi.listByClient).mockResolvedValueOnce({
      data: { accounts: [] },
    })

    const store = useClientAccountStore()
    await store.fetchAccounts('42')

    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('42')
  })

  it('fetchAccounts sets error on API failure', async () => {
    vi.mocked(clientAccountApi.listByClient).mockRejectedValueOnce({
      response: { data: { message: 'Unauthorized' } },
    })

    const store = useClientAccountStore()
    await store.fetchAccounts('5')

    expect(store.accounts).toHaveLength(0)
    expect(store.error).toBe('Unauthorized')
    expect(store.loading).toBe(false)
  })

  it('sets loading true during fetch and false after', async () => {
    let resolve!: (v: any) => void
    vi.mocked(clientAccountApi.listByClient).mockReturnValueOnce(
      new Promise(r => { resolve = r })
    )

    const store = useClientAccountStore()
    const promise = store.fetchAccounts('5')
    expect(store.loading).toBe(true)

    resolve({ data: { accounts: [] } })
    await promise
    expect(store.loading).toBe(false)
  })
})
