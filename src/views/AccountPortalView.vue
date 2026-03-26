<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { clientManagementApi } from '../api/clientManagement'
import { employeeCardApi, maskCardNumber, CARD_TYPE_LABELS, type Card } from '../api/card'

const router = useRouter()
const store = useAccountStore()

// Client name lookup
const clientMap = ref<Record<string, { ime: string; prezime: string; email: string }>>({})

async function loadClientNames() {
  try {
    const res = await clientManagementApi.list({ page: 1, pageSize: 1000 })
    const clients = res.data.clients ?? []
    const map: Record<string, { ime: string; prezime: string; email: string }> = {}
    for (const c of clients) {
      map[c.id] = { ime: c.ime, prezime: c.prezime, email: c.email }
    }
    clientMap.value = map
  } catch { /* ignore */ }
}

function clientName(clientId: string): string {
  const c = clientMap.value[clientId]
  return c ? `${c.prezime} ${c.ime}` : '—'
}

function clientEmail(clientId: number): string {
  const c = clientMap.value[String(clientId)]
  return c ? c.email : '—'
}

function cardOwnerName(clientId: number): string {
  const c = clientMap.value[String(clientId)]
  return c ? `${c.ime} ${c.prezime}` : '—'
}

// Filters
const filterName = ref('')
const filterBrojRacuna = ref('')

function applyFilters() {
  store.setFilters({
    clientName: filterName.value,
    accountNumber: filterBrojRacuna.value,
  })
  store.fetchAllAccounts()
}

function clearFilters() {
  filterName.value = ''
  filterBrojRacuna.value = ''
  store.clearFilters()
  store.fetchAllAccounts()
}

function tipLabel(tip: string) {
  return tip === 'tekuci' ? 'Tekući' : tip === 'devizni' ? 'Devizni' : tip
}

function vrstaLabel(vrsta: string) {
  return vrsta === 'licni' ? 'Lični' : vrsta === 'poslovni' ? 'Poslovni' : vrsta
}

// --- Cards panel ---
const selectedAccount = ref<any>(null)
const cards = ref<Card[]>([])
const cardsLoading = ref(false)
const cardsError = ref('')
const actionError = ref('')
const actionLoading = ref<number | null>(null) // card id being acted on

function statusLabel(s: string) {
  return { aktivna: 'Aktivna', blokirana: 'Blokirana', deaktivirana: 'Deaktivirana' }[s] ?? s
}

function statusClass(s: string) {
  return { aktivna: 'badge-active', blokirana: 'badge-blocked', deaktivirana: 'badge-disabled' }[s] ?? 'badge-disabled'
}

function vrstaKarticaLabel(v: string) {
  return CARD_TYPE_LABELS[v] ?? v
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS')
}

async function openCards(account: any) {
  selectedAccount.value = account
  cards.value = []
  cardsError.value = ''
  actionError.value = ''
  cardsLoading.value = true
  try {
    const res = await employeeCardApi.listByAccount(account.id)
    cards.value = res.data ?? []
  } catch (e: any) {
    cardsError.value = e.response?.data?.error || 'Greška pri učitavanju kartica.'
  } finally {
    cardsLoading.value = false
  }
}

function closePanel() {
  selectedAccount.value = null
  cards.value = []
  cardsError.value = ''
  actionError.value = ''
}

async function doBlock(card: Card) {
  actionLoading.value = card.id
  actionError.value = ''
  try {
    const res = await employeeCardApi.blockCard(card.id, card.client_id)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = res.data
  } catch (e: any) {
    actionError.value = e.response?.data?.error || 'Greška pri blokiranju.'
  } finally {
    actionLoading.value = null
  }
}

async function doUnblock(card: Card) {
  actionLoading.value = card.id
  actionError.value = ''
  try {
    const res = await employeeCardApi.unblockCard(card.id)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = res.data
  } catch (e: any) {
    actionError.value = e.response?.data?.error || 'Greška pri deblokiranju.'
  } finally {
    actionLoading.value = null
  }
}

async function doDeactivate(card: Card) {
  if (!confirm(`Deaktivirati karticu ${maskCardNumber(card.broj_kartice)}? Ova akcija je ireverzibilna.`)) return
  actionLoading.value = card.id
  actionError.value = ''
  try {
    const res = await employeeCardApi.deactivateCard(card.id)
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = res.data
  } catch (e: any) {
    actionError.value = e.response?.data?.error || 'Greška pri deaktivaciji.'
  } finally {
    actionLoading.value = null
  }
}

const totalPages = () => Math.ceil(store.total / store.pageSize)

onMounted(async () => {
  await Promise.all([
    store.fetchAllAccounts(),
    loadClientNames(),
  ])
})
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Upravljanje računima</h1>
      <button class="btn-primary" @click="router.push('/accounts/new')">+ Novi račun</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
        v-model="filterName"
        placeholder="Pretraži po imenu ili prezimenu vlasnika"
        @keyup.enter="applyFilters"
      />
      <input
        v-model="filterBrojRacuna"
        placeholder="Pretraži po broju računa"
        @keyup.enter="applyFilters"
      />
      <button class="btn-primary" @click="applyFilters">Pretraži</button>
      <button class="btn-secondary" @click="clearFilters">Poništi</button>
    </div>

    <p v-if="store.error" class="global-error" style="margin-bottom:12px">{{ store.error }}</p>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Broj računa</th>
            <th>Ime i prezime vlasnika</th>
            <th>Vrsta</th>
            <th>Tip</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.loading">
            <td colspan="4" style="text-align:center;padding:24px;color:#6b7280">Učitavam...</td>
          </tr>
          <tr v-else-if="store.accounts.length === 0">
            <td colspan="4" style="text-align:center;padding:24px;color:#6b7280">Nema pronađenih računa.</td>
          </tr>
          <tr
            v-for="account in store.accounts"
            :key="account.id"
            :class="{ 'row-selected': selectedAccount?.id === account.id }"
            style="cursor:pointer"
            @click="openCards(account)"
          >
            <td><code style="font-size:13px">{{ account.brojRacuna }}</code></td>
            <td style="font-weight:500">{{ clientName(account.clientId) }}</td>
            <td>{{ vrstaLabel(account.vrsta) }}</td>
            <td>{{ tipLabel(account.tip) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.total > store.pageSize" class="pagination">
      <button class="btn-secondary btn-sm" :disabled="store.page <= 1" @click="store.page--; store.fetchAllAccounts()">←</button>
      <span>Strana {{ store.page }} od {{ totalPages() }} ({{ store.total }} ukupno)</span>
      <button class="btn-secondary btn-sm" :disabled="store.page >= totalPages()" @click="store.page++; store.fetchAllAccounts()">→</button>
    </div>
  </div>

  <!-- Cards side panel -->
  <div v-if="selectedAccount" class="panel-overlay" @click.self="closePanel">
    <div class="panel">
      <div class="panel-header">
        <div>
          <div class="panel-title">Kartice računa</div>
          <code class="panel-subtitle">{{ selectedAccount.brojRacuna }}</code>
        </div>
        <button class="panel-close" @click="closePanel">✕</button>
      </div>

      <div class="panel-body">
        <div v-if="cardsLoading" class="panel-empty">Učitavam kartice...</div>
        <div v-else-if="cardsError" class="panel-error">{{ cardsError }}</div>

        <div v-else-if="cards.length === 0" class="panel-empty">
          Ovaj račun nema kartica.
        </div>

        <div v-else>
          <div v-if="actionError" class="panel-error" style="margin-bottom:12px">{{ actionError }}</div>

          <div v-for="card in cards" :key="card.id" class="card-row">
            <div class="card-row-info">
              <div class="card-row-number">{{ maskCardNumber(card.broj_kartice) }}</div>
              <div class="card-row-owner">
                <span class="card-owner-name">{{ cardOwnerName(card.client_id) }}</span>
                <span class="card-owner-email">{{ clientEmail(card.client_id) }}</span>
              </div>
              <div class="card-row-meta">
                {{ vrstaKarticaLabel(card.vrsta_kartice) }}
                <span v-if="card.naziv_kartice"> · {{ card.naziv_kartice }}</span>
                · Važi do {{ fmtDate(card.datum_isteka) }}
              </div>
              <span :class="['card-badge', statusClass(card.status)]">
                {{ statusLabel(card.status) }}
              </span>
            </div>

            <div class="card-row-actions">
              <button
                v-if="card.status === 'aktivna'"
                class="action-btn action-block"
                :disabled="actionLoading === card.id"
                @click="doBlock(card)"
              >
                Blokiraj
              </button>
              <button
                v-if="card.status === 'blokirana'"
                class="action-btn action-unblock"
                :disabled="actionLoading === card.id"
                @click="doUnblock(card)"
              >
                Deblokiraj
              </button>
              <button
                v-if="card.status !== 'deaktivirana'"
                class="action-btn action-deactivate"
                :disabled="actionLoading === card.id"
                @click="doDeactivate(card)"
              >
                Deaktiviraj
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row-selected { background: #eff6ff !important; }

/* Side panel */
.panel-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  z-index: 50; display: flex; justify-content: flex-end;
}
.panel {
  width: 480px; max-width: 100vw; background: #fff;
  height: 100vh; display: flex; flex-direction: column;
  box-shadow: -4px 0 32px rgba(0,0,0,0.12);
}
.panel-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 24px; border-bottom: 1px solid #e2e8f0;
  position: sticky; top: 0; background: #fff; z-index: 1;
}
.panel-title { font-size: 18px; font-weight: 700; color: #0f172a; }
.panel-subtitle { font-size: 13px; color: #64748b; display: block; margin-top: 2px; }
.panel-close {
  background: none; border: none; font-size: 18px; color: #94a3b8;
  cursor: pointer; padding: 4px 8px; border-radius: 6px;
}
.panel-close:hover { background: #f1f5f9; }
.panel-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
.panel-empty { text-align: center; color: #94a3b8; padding: 32px 0; font-size: 14px; }
.panel-error { background: #fef2f2; color: #dc2626; padding: 10px 14px; border-radius: 8px; font-size: 13px; }

/* Card rows */
.card-row {
  border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 16px; margin-bottom: 12px; background: #fff;
}
.card-row-number {
  font-family: 'SF Mono', monospace; font-size: 15px;
  font-weight: 600; color: #0f172a; margin-bottom: 6px; letter-spacing: 1px;
}
.card-row-owner { margin-bottom: 6px; }
.card-owner-name { font-size: 13px; font-weight: 600; color: #1e293b; margin-right: 8px; }
.card-owner-email { font-size: 12px; color: #64748b; }
.card-row-meta { font-size: 12px; color: #64748b; margin-bottom: 10px; }
.card-badge {
  display: inline-block; padding: 2px 9px; border-radius: 20px;
  font-size: 11px; font-weight: 700; margin-bottom: 12px;
}
.badge-active   { background: #dcfce7; color: #166534; }
.badge-blocked  { background: #fee2e2; color: #991b1b; }
.badge-disabled { background: #f1f5f9; color: #475569; }

.card-row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.action-btn {
  padding: 6px 14px; border-radius: 8px; font-size: 12px;
  font-weight: 600; border: none; cursor: pointer; transition: all 0.15s;
}
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-block     { background: #fef2f2; color: #dc2626; }
.action-block:hover:not(:disabled)      { background: #fee2e2; }
.action-unblock   { background: #f0fdf4; color: #16a34a; }
.action-unblock:hover:not(:disabled)    { background: #dcfce7; }
.action-deactivate { background: #f1f5f9; color: #475569; }
.action-deactivate:hover:not(:disabled) { background: #e2e8f0; }
</style>
