<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { transferApi, type TransferItem } from '../../api/transfer'
import type { ClientAccountItem } from '../../api/clientAccount'
import api from '../../api/clientAuth'

const router = useRouter()
const authStore = useClientAuthStore()
const store = useClientAccountStore()

// Active accounts sorted by raspolozivoStanje descending
const activeAccounts = computed(() =>
  [...store.accounts]
    .filter(a => a.status === 'aktivan')
    .sort((a, b) => b.raspolozivoStanje - a.raspolozivoStanje)
)

// Selected account
const selectedAccount = ref<ClientAccountItem | null>(null)

// Transactions
const transfers = ref<TransferItem[]>([])
const transfersLoading = ref(false)
const transfersError = ref('')
const sortBy = ref<'date' | 'status'>('date')
const sortDir = ref<'desc' | 'asc'>('desc')

const sortedTransfers = computed(() => {
  return [...transfers.value].sort((a, b) => {
    if (sortBy.value === 'date') {
      const diff = new Date(a.vremeTransakcije).getTime() - new Date(b.vremeTransakcije).getTime()
      return sortDir.value === 'desc' ? -diff : diff
    } else {
      const cmp = a.status.localeCompare(b.status)
      return sortDir.value === 'desc' ? -cmp : cmp
    }
  })
})

// Details modal
const detailsAccount = ref<ClientAccountItem | null>(null)

// Rename
const showRename = ref(false)
const renameValue = ref('')
const renameError = ref('')
const renameLoading = ref(false)

function openRename() {
  renameValue.value = detailsAccount.value?.naziv || ''
  renameError.value = ''
  showRename.value = true
}

async function handleRename() {
  if (!detailsAccount.value || !renameValue.value.trim()) {
    renameError.value = 'Naziv ne može biti prazan.'
    return
  }
  const newName = renameValue.value.trim()
  if (newName === (detailsAccount.value.naziv || '').trim()) {
    renameError.value = 'Novi naziv je isti kao trenutni.'
    return
  }
  const duplicate = store.accounts.find(
    a => a.id !== detailsAccount.value!.id && (a.naziv || '').trim().toLowerCase() === newName.toLowerCase()
  )
  if (duplicate) {
    renameError.value = 'Već imate račun sa tim nazivom.'
    return
  }
  renameLoading.value = true
  renameError.value = ''
  try {
    await api.put(`/accounts/${detailsAccount.value.id}/name`, { naziv: renameValue.value })
    detailsAccount.value.naziv = renameValue.value
    showRename.value = false
    if (authStore.client?.id) await store.fetchAccounts(authStore.client.id)
  } catch (e: any) {
    renameError.value = e.response?.data?.message || 'Greška pri promeni naziva.'
  } finally {
    renameLoading.value = false
  }
}

// Limits
const showLimits = ref(false)
const limitsForm = ref({ dnevni: '', mesecni: '' })
const limitsError = ref('')
const limitsLoading = ref(false)

function openLimits() {
  limitsForm.value = {
    dnevni: String(detailsAccount.value?.dnevniLimit ?? 0),
    mesecni: String(detailsAccount.value?.mesecniLimit ?? 0),
  }
  limitsError.value = ''
  showLimits.value = true
}

async function handleLimitsSubmit() {
  limitsLoading.value = true
  limitsError.value = ''
  try {
    await api.put(`/accounts/${detailsAccount.value!.id}/limits`, {
      dnevni_limit: Number(limitsForm.value.dnevni),
      mesecni_limit: Number(limitsForm.value.mesecni),
    })
    detailsAccount.value!.dnevniLimit = Number(limitsForm.value.dnevni)
    detailsAccount.value!.mesecniLimit = Number(limitsForm.value.mesecni)
    showLimits.value = false
    if (authStore.client?.id) await store.fetchAccounts(authStore.client.id)
  } catch (e: any) {
    limitsError.value = e.response?.data?.message || 'Greška pri promeni limita.'
  } finally {
    limitsLoading.value = false
  }
}

function formatAmount(amount: number, currency: string) {
  return `${Number(amount).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`
}

function tipLabel(tip: string) {
  return tip === 'tekuci' ? 'Tekući' : 'Devizni'
}

function vrstaLabel(vrsta: string) {
  return vrsta === 'licni' ? 'Lični' : 'Poslovni'
}

function podvrstaLabel(podvrsta?: string) {
  return {
    standardni: 'Standardni',
    stedni: 'Stedni',
    penzionerski: 'Penzionerski',
    za_mlade: 'Za mlade',
    za_studente: 'Za studente',
    za_nezaposlene: 'Za nezaposlene',
    doo: 'DOO',
    ad: 'AD',
    fondacija: 'Fondacija',
  }[podvrsta ?? ''] ?? podvrsta ?? ''
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('sr-RS')
}

function selectAccount(account: ClientAccountItem) {
  selectedAccount.value = account
}

async function loadTransfers(accountId: string) {
  transfersLoading.value = true
  transfersError.value = ''
  transfers.value = []
  try {
    const res = await transferApi.listByAccount(accountId)
    transfers.value = res.data.transfers ?? []
  } catch (e: any) {
    transfersError.value = e.response?.data?.message || 'Greška pri učitavanju transakcija.'
  } finally {
    transfersLoading.value = false
  }
}

watch(selectedAccount, (acc) => {
  if (acc) loadTransfers(acc.id)
})

watch(activeAccounts, (accs) => {
  if (accs.length > 0 && !selectedAccount.value && accs[0]) {
    selectedAccount.value = accs[0]
  }
}, { immediate: true })

onMounted(() => {
  if (authStore.client?.id) {
    store.fetchAccounts(authStore.client.id)
  }
})
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Računi</h1>
    </div>

    <p v-if="store.error" class="global-error" style="margin-bottom:16px">{{ store.error }}</p>

    <div v-if="store.loading" style="text-align:center;padding:40px;color:#6b7280">
      Učitavam račune...
    </div>

    <template v-else-if="activeAccounts.length === 0">
      <div style="text-align:center;padding:40px;color:#6b7280">Nema aktivnih računa.</div>
    </template>

    <template v-else>
      <!-- Accounts list -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:32px">
        <div
          v-for="account in activeAccounts"
          :key="account.id"
          class="card"
          style="padding:16px 20px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;transition:border-color .15s"
          :style="selectedAccount?.id === account.id ? 'border: 2px solid #2563eb;' : 'border: 2px solid transparent;'"
          @click="selectAccount(account)"
        >
          <div>
            <div style="font-weight:600;font-size:15px;margin-bottom:2px">
              {{ account.naziv || tipLabel(account.tip) }}
            </div>
            <code style="font-size:12px;color:#6b7280">{{ account.brojRacuna }}</code>
          </div>

          <div style="display:flex;align-items:center;gap:20px">
            <div style="text-align:right">
              <div style="font-size:11px;color:#6b7280;margin-bottom:1px">Raspoloživo stanje</div>
              <div style="font-size:18px;font-weight:700;color:#16a34a">
                {{ formatAmount(account.raspolozivoStanje, account.currencyKod) }}
              </div>
            </div>
            <button
              class="btn-secondary btn-sm"
              @click.stop="detailsAccount = account"
            >Detalji</button>
          </div>
        </div>
      </div>

      <!-- Transactions for selected account -->
      <div v-if="selectedAccount">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h2 style="margin:0;font-size:18px">
            Transakcije — {{ selectedAccount.naziv || tipLabel(selectedAccount.tip) }}
          </h2>
          <div style="display:flex;gap:8px;align-items:center">
            <select
              v-model="sortBy"
              style="padding:4px 8px;border-radius:6px;border:1px solid #d1d5db;font-size:13px;background:#1f2937;color:#f9fafb"
            >
              <option value="date">Sortiraj po datumu</option>
              <option value="status">Sortiraj po tipu</option>
            </select>
            <button class="btn-secondary btn-sm" @click="sortDir = sortDir === 'desc' ? 'asc' : 'desc'">
              {{ sortDir === 'desc' ? '↓' : '↑' }}
            </button>
          </div>
        </div>

        <div v-if="transfersLoading" style="text-align:center;padding:24px;color:#6b7280">
          Učitavam transakcije...
        </div>
        <p v-else-if="transfersError" class="global-error">{{ transfersError }}</p>
        <div v-else-if="sortedTransfers.length === 0" style="text-align:center;padding:24px;color:#6b7280">
          Nema transakcija za ovaj račun.
        </div>
        <div v-else class="card" style="padding:0;overflow:hidden">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Svrha</th>
                <th>Iznos</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in sortedTransfers" :key="t.id">
                <td style="font-size:13px;white-space:nowrap">{{ formatDate(t.vremeTransakcije) }}</td>
                <td style="font-size:13px">{{ t.svrha || '—' }}</td>
                <td style="font-size:13px;white-space:nowrap">
                  <span :style="t.racunPosiljaocaId === selectedAccount!.id ? 'color:#dc2626' : 'color:#16a34a'">
                    {{ t.racunPosiljaocaId === selectedAccount!.id ? '-' : '+' }}{{ formatAmount(t.iznos, t.valutaIznosa) }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="t.status === 'completed' ? 'badge-green' : 'badge'">
                    {{ t.status }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>

  <!-- Details modal -->
  <div v-if="detailsAccount" class="modal-overlay" @click.self="detailsAccount = null">
    <div class="modal" style="max-width:480px">
      <div style="padding:32px">
        <!-- Header with close -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
          <div>
            <div style="font-size:22px;font-weight:700;color:#0f172a">{{ detailsAccount.naziv || tipLabel(detailsAccount.tip) }}</div>
            <code style="font-size:13px;color:#94a3b8">{{ detailsAccount.brojRacuna }}</code>
          </div>
          <button class="modal-close" @click="detailsAccount = null" style="margin-top:-4px">✕</button>
        </div>

        <!-- Balance hero -->
        <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:14px;padding:24px;color:#fff;margin-bottom:24px">
          <div style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Stanje računa</div>
          <div style="font-size:32px;font-weight:700">{{ formatAmount(detailsAccount.stanje, detailsAccount.currencyKod) }}</div>
          <div style="display:flex;gap:24px;margin-top:16px">
            <div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5)">Raspoloživo</div>
              <div style="font-size:16px;font-weight:600">{{ formatAmount(detailsAccount.raspolozivoStanje, detailsAccount.currencyKod) }}</div>
            </div>
            <div>
              <div style="font-size:11px;color:rgba(255,255,255,0.5)">Rezervisano</div>
              <div style="font-size:16px;font-weight:600">0,00 {{ detailsAccount.currencyKod }}</div>
            </div>
          </div>
        </div>

        <!-- Details grid -->
        <div style="display:flex;flex-direction:column;gap:2px">
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Naziv računa</span>
            <span style="font-weight:500;color:#0f172a">{{ detailsAccount.naziv || tipLabel(detailsAccount.tip) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Broj računa</span>
            <span style="font-family:'SF Mono',monospace;font-size:13px;color:#0f172a">{{ detailsAccount.brojRacuna }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Vlasnik</span>
            <span style="font-weight:500;color:#0f172a">{{ authStore.client?.ime }} {{ authStore.client?.prezime }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Tip</span>
            <span style="color:#0f172a">
              {{ tipLabel(detailsAccount.tip) }} — {{ vrstaLabel(detailsAccount.vrsta) }}
              <template v-if="detailsAccount.podvrsta">
                — {{ podvrstaLabel(detailsAccount.podvrsta) }}
              </template>
            </span>
          </div>
          <template v-if="detailsAccount.vrsta === 'poslovni' && detailsAccount.firma">
            <div style="padding:10px 0 4px;font-size:12px;font-weight:600;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase">Podaci o firmi</div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
              <span style="color:#64748b">Naziv firme</span>
              <span style="font-weight:500;color:#0f172a">{{ detailsAccount.firma.naziv }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
              <span style="color:#64748b">Matični broj</span>
              <span style="color:#0f172a">{{ detailsAccount.firma.maticniBroj }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
              <span style="color:#64748b">PIB</span>
              <span style="color:#0f172a">{{ detailsAccount.firma.pib }}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
              <span style="color:#64748b">Adresa</span>
              <span style="color:#0f172a">{{ detailsAccount.firma.adresa }}</span>
            </div>
          </template>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Raspoloživo stanje</span>
            <span style="font-weight:600;color:#16a34a">{{ formatAmount(detailsAccount.raspolozivoStanje, detailsAccount.currencyKod) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Rezervisana sredstva</span>
            <span style="color:#0f172a">0,00 {{ detailsAccount.currencyKod }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Stanje računa</span>
            <span style="font-weight:700;color:#0f172a">{{ formatAmount(detailsAccount.stanje, detailsAccount.currencyKod) }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Dnevna potrošnja</span>
            <span style="color:#0f172a">{{ formatAmount(detailsAccount.dnevnaPotrosnja ?? 0, detailsAccount.currencyKod) }}
              <span style="color:#94a3b8;font-size:12px"> / {{ formatAmount(detailsAccount.dnevniLimit, detailsAccount.currencyKod) }}</span>
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Mesečna potrošnja</span>
            <span style="color:#0f172a">{{ formatAmount(detailsAccount.mesecnaPotrosnja ?? 0, detailsAccount.currencyKod) }}
              <span style="color:#94a3b8;font-size:12px"> / {{ formatAmount(detailsAccount.mesecniLimit, detailsAccount.currencyKod) }}</span>
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px">
            <span style="color:#64748b">Datum isteka</span>
            <span style="color:#0f172a">{{ detailsAccount.datumIsteka ? new Date(detailsAccount.datumIsteka).toLocaleDateString('sr-RS') : '—' }}</span>
          </div>
          <div v-if="detailsAccount.tip === 'tekuci'" style="display:flex;justify-content:space-between;padding:12px 0;font-size:14px">
            <span style="color:#64748b">Održavanje računa</span>
            <span style="color:#0f172a">{{ formatAmount(detailsAccount.odrzavanjeRacuna, 'RSD') }}</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:24px">
          <button class="btn-primary" style="width:100%;padding:11px;border-radius:10px" @click="openRename">Promena naziva računa</button>
          <button class="btn-primary" style="width:100%;padding:11px;border-radius:10px;background:#16a34a" @click="router.push('/client/payments/new')">Novo plaćanje</button>
          <button class="btn-primary" style="width:100%;padding:11px;border-radius:10px;background:#7c3aed" @click="openLimits">Promena limita</button>
          <button class="btn-secondary" style="width:100%;padding:11px;border-radius:10px;margin-top:4px" @click="detailsAccount = null">Zatvori</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Rename modal -->
  <div v-if="showRename" class="modal-overlay" @click.self="showRename = false">
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <h2>Promena naziva</h2>
        <button class="modal-close" @click="showRename = false">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Novi naziv računa</label>
          <input v-model="renameValue" placeholder="Unesite novi naziv" @keyup.enter="handleRename" />
        </div>
        <p v-if="renameError" class="global-error" style="margin-top:8px">{{ renameError }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" @click="showRename = false">Otkaži</button>
        <button class="btn-primary" :disabled="renameLoading" @click="handleRename">
          {{ renameLoading ? 'Čuvam...' : 'Sačuvaj' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Limits modal -->
  <div v-if="showLimits" class="modal-overlay" @click.self="showLimits = false">
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <h2>Promena limita</h2>
        <button class="modal-close" @click="showLimits = false">✕</button>
      </div>
      <div class="modal-body">
          <div class="form-group" style="margin-bottom:14px">
            <label>Dnevni limit</label>
            <input v-model="limitsForm.dnevni" type="number" min="0" />
          </div>
          <div class="form-group">
            <label>Mesečni limit</label>
            <input v-model="limitsForm.mesecni" type="number" min="0" />
          </div>
        <p v-if="limitsError" class="global-error" style="margin-top:8px">{{ limitsError }}</p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" @click="showLimits = false">Otkaži</button>
        <button class="btn-primary" :disabled="limitsLoading" @click="handleLimitsSubmit">
          {{ limitsLoading ? 'Čuvam...' : 'Sačuvaj' }}
        </button>
      </div>
    </div>
  </div>
</template>
