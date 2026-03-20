<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { clientManagementApi } from '../api/clientManagement'

const router = useRouter()
const store = useAccountStore()

// Client name lookup
const clientMap = ref<Record<string, { ime: string; prezime: string }>>({})

async function loadClientNames() {
  try {
    const res = await clientManagementApi.list({ page: 1, pageSize: 1000 })
    const clients = res.data.clients ?? []
    const map: Record<string, { ime: string; prezime: string }> = {}
    for (const c of clients) {
      map[c.id] = { ime: c.ime, prezime: c.prezime }
    }
    clientMap.value = map
  } catch { /* ignore */ }
}

function clientName(clientId: string): string {
  const c = clientMap.value[clientId]
  return c ? `${c.prezime} ${c.ime}` : '—'
}

function clientPrezime(clientId: string): string {
  return clientMap.value[clientId]?.prezime ?? ''
}

// Sort accounts by client prezime
const sortedAccounts = computed(() => {
  return [...store.accounts].sort((a, b) =>
    clientPrezime(a.clientId).localeCompare(clientPrezime(b.clientId), 'sr-RS')
  )
})

// Filters
const filterName = ref('')
const filterBrojRacuna = ref('')

function applyFilters() {
  store.setFilters({
    clientName: filterName.value,
  })
  store.fetchAllAccounts()
}

function clearFilters() {
  filterName.value = ''
  filterBrojRacuna.value = ''
  store.clearFilters()
  store.fetchAllAccounts()
}

// Filter locally by broj racuna (backend doesn't support it)
const filteredAccounts = computed(() => {
  if (!filterBrojRacuna.value) return sortedAccounts.value
  const q = filterBrojRacuna.value.toLowerCase()
  return sortedAccounts.value.filter(a => a.brojRacuna.toLowerCase().includes(q))
})

function tipLabel(tip: string) {
  return tip === 'tekuci' ? 'Tekući' : tip === 'devizni' ? 'Devizni' : tip
}

function vrstaLabel(vrsta: string) {
  return vrsta === 'licni' ? 'Lični' : vrsta === 'poslovni' ? 'Poslovni' : vrsta
}

function openCards(account: any) {
  // Sprint 3: kartice — za sad placeholder
  alert(`Stranica kartica za račun ${account.brojRacuna} — biće implementirana u Sprint 3.`)
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
          <tr v-else-if="filteredAccounts.length === 0">
            <td colspan="4" style="text-align:center;padding:24px;color:#6b7280">Nema pronađenih računa.</td>
          </tr>
          <tr
            v-for="account in filteredAccounts"
            :key="account.id"
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
</template>
