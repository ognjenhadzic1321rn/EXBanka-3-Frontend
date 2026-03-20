<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { type ClientDetail, type UpdateClientPayload } from '../api/clientManagement'
import { useClientStore } from '../stores/client'

const store = useClientStore()

const editingClient = ref<ClientDetail | null>(null)
const editForm = ref<UpdateClientPayload & { datumRodjenjaStr: string }>({
  ime: '', prezime: '', datumRodjenja: 0, datumRodjenjaStr: '',
  pol: 'M', email: '', brojTelefona: '', adresa: '',
})
const editError = ref('')
const editLoading = ref(false)

// Sort clients alphabetically by prezime
const sortedClients = computed(() => {
  return [...store.clients].sort((a, b) =>
    a.prezime.localeCompare(b.prezime, 'sr-RS')
  )
})

async function openEdit(clientId: string) {
  try {
    const detail = await store.getClient(clientId)
    editingClient.value = detail
    editForm.value = {
      ime: detail.ime,
      prezime: detail.prezime,
      datumRodjenja: 0,
      datumRodjenjaStr: detail.datumRodjenja && Number(detail.datumRodjenja) > 0
        ? new Date(Number(detail.datumRodjenja) * 1000).toISOString().substring(0, 10)
        : '',
      pol: detail.pol || 'M',
      email: detail.email,
      brojTelefona: detail.brojTelefona || '',
      adresa: detail.adresa || '',
    }
    editError.value = ''
  } catch {
    store.error = 'Greška pri učitavanju podataka klijenta.'
  }
}

async function handleSave() {
  if (!editingClient.value) return

  // Basic validation
  if (!editForm.value.ime.trim() || !editForm.value.prezime.trim()) {
    editError.value = 'Ime i prezime su obavezni.'
    return
  }
  if (!editForm.value.email.trim()) {
    editError.value = 'Email je obavezan.'
    return
  }

  editError.value = ''
  editLoading.value = true
  try {
    const payload: UpdateClientPayload = {
      ime: editForm.value.ime,
      prezime: editForm.value.prezime,
      datumRodjenja: editForm.value.datumRodjenjaStr
        ? Math.floor(new Date(editForm.value.datumRodjenjaStr).getTime() / 1000)
        : 0,
      pol: editForm.value.pol,
      email: editForm.value.email,
      brojTelefona: editForm.value.brojTelefona,
      adresa: editForm.value.adresa,
    }
    await store.updateClient(editingClient.value.id, payload)
    editingClient.value = null
  } catch (e: any) {
    const msg = e.response?.data?.message || e.response?.data?.error || ''
    if (msg.toLowerCase().includes('email') && (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('postoji') || msg.toLowerCase().includes('already'))) {
      editError.value = 'Email adresa je već u upotrebi. Unesite drugu email adresu.'
    } else {
      editError.value = msg || 'Greška pri čuvanju izmena.'
    }
  } finally {
    editLoading.value = false
  }
}

function applyFilters() {
  store.setFilters({
    emailFilter: store.filters.emailFilter,
    nameFilter: store.filters.nameFilter,
  })
  store.fetchClients()
}

function clearFilters() {
  store.clearFilters()
  store.fetchClients()
}

const totalPages = () => Math.ceil(store.total / store.pageSize)

onMounted(() => store.fetchClients())
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Upravljanje klijentima</h1>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
        v-model="store.filters.nameFilter"
        placeholder="Pretraži po imenu ili prezimenu"
        @keyup.enter="applyFilters"
      />
      <input
        v-model="store.filters.emailFilter"
        placeholder="Pretraži po email-u"
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
            <th>Ime i prezime</th>
            <th>Email adresa</th>
            <th>Broj telefona</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="store.loading">
            <td colspan="3" style="text-align:center;padding:24px;color:#6b7280">Učitavam...</td>
          </tr>
          <tr v-else-if="store.clients.length === 0">
            <td colspan="3" style="text-align:center;padding:24px;color:#6b7280">Nema pronađenih klijenata.</td>
          </tr>
          <tr
            v-for="client in sortedClients"
            :key="client.id"
            @click="openEdit(client.id)"
            style="cursor:pointer"
          >
            <td>
              <div style="font-weight:500">{{ client.prezime }} {{ client.ime }}</div>
            </td>
            <td>{{ client.email }}</td>
            <td>{{ client.brojTelefona || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.total > store.pageSize" class="pagination">
      <button class="btn-secondary btn-sm" :disabled="store.page <= 1" @click="store.page--; store.fetchClients()">←</button>
      <span>Strana {{ store.page }} od {{ totalPages() }} ({{ store.total }} ukupno)</span>
      <button class="btn-secondary btn-sm" :disabled="store.page >= totalPages()" @click="store.page++; store.fetchClients()">→</button>
    </div>
  </div>

  <!-- Edit dialog -->
  <div v-if="editingClient" class="modal-overlay" @click.self="editingClient = null">
    <div class="modal">
      <div class="modal-header">
        <h2>Izmena klijenta</h2>
        <button class="modal-close" @click="editingClient = null">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Ime *</label>
            <input v-model="editForm.ime" required />
          </div>
          <div class="form-group">
            <label>Prezime *</label>
            <input v-model="editForm.prezime" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Datum rođenja</label>
            <input v-model="editForm.datumRodjenjaStr" type="date" />
          </div>
          <div class="form-group">
            <label>Pol</label>
            <select v-model="editForm.pol">
              <option value="M">Muški</option>
              <option value="F">Ženski</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Email *</label>
            <input v-model="editForm.email" type="email" required />
          </div>
          <div class="form-group">
            <label>Broj telefona</label>
            <input v-model="editForm.brojTelefona" />
          </div>
        </div>

        <div class="form-group">
          <label>Adresa</label>
          <input v-model="editForm.adresa" />
        </div>

        <p v-if="editError" class="global-error">{{ editError }}</p>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="editingClient = null">Otkaži</button>
        <button class="btn-primary" @click="handleSave" :disabled="editLoading">
          {{ editLoading ? 'Čuvam...' : 'Sačuvaj izmene' }}
        </button>
      </div>
    </div>
  </div>
</template>
