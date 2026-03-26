<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { employeeLoanApi, type Loan } from '../api/employeeLoan'
import { LOAN_TYPES, EMPLOYMENT_STATUSES } from '../api/loan'

const auth = useAuthStore()

const requests = ref<Loan[]>([])
const loading = ref(false)
const error = ref('')

const filterVrsta = ref('')
const filterBrojRacuna = ref('')

const actionLoading = ref<number | null>(null)
const actionError = ref('')
const actionSuccess = ref('')

// Detail modal
const selectedLoan = ref<Loan | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await employeeLoanApi.listRequests({
      vrsta: filterVrsta.value,
      brojRacuna: filterBrojRacuna.value,
    })
    requests.value = res.data ?? []
  } catch (e: any) {
    error.value = e.response?.data?.error || 'Greška pri učitavanju zahteva.'
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  filterVrsta.value = ''
  filterBrojRacuna.value = ''
  load()
}

async function approve(loan: Loan) {
  if (!confirm(`Odobri kredit ${loan.broj_kredita}?`)) return
  actionLoading.value = loan.id
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await employeeLoanApi.approve(loan.id, Number(auth.employee?.id ?? 0))
    actionSuccess.value = `Kredit ${loan.broj_kredita} je odobren.`
    selectedLoan.value = null
    await load()
  } catch (e: any) {
    actionError.value = e.response?.data?.error || 'Greška pri odobravanju.'
  } finally {
    actionLoading.value = null
  }
}

async function reject(loan: Loan) {
  if (!confirm(`Odbij kredit ${loan.broj_kredita}?`)) return
  actionLoading.value = loan.id
  actionError.value = ''
  actionSuccess.value = ''
  try {
    await employeeLoanApi.reject(loan.id, Number(auth.employee?.id ?? 0))
    actionSuccess.value = `Kredit ${loan.broj_kredita} je odbijen.`
    selectedLoan.value = null
    await load()
  } catch (e: any) {
    actionError.value = e.response?.data?.error || 'Greška pri odbijanju.'
  } finally {
    actionLoading.value = null
  }
}

function vrstaLabel(v: string) {
  return LOAN_TYPES.find(t => t.value === v)?.label ?? v
}

function employmentLabel(v: string) {
  return EMPLOYMENT_STATUSES.find(s => s.value === v)?.label ?? v
}

function fmtMoney(n: number) {
  if (n == null) return '—'
  return n.toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS')
}

onMounted(load)
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Zahtevi za kredit</h1>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterVrsta" @change="load">
        <option value="">Sve vrste</option>
        <option v-for="t in LOAN_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
      </select>
      <input
        v-model="filterBrojRacuna"
        placeholder="Broj računa"
        @keyup.enter="load"
      />
      <button class="btn-primary" @click="load">Pretraži</button>
      <button class="btn-secondary" @click="clearFilters">Poništi</button>
    </div>

    <p v-if="actionSuccess" class="global-success" style="margin-bottom:12px">{{ actionSuccess }}</p>
    <p v-if="actionError" class="global-error" style="margin-bottom:12px">{{ actionError }}</p>
    <p v-if="error" class="global-error" style="margin-bottom:12px">{{ error }}</p>

    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Broj kredita</th>
            <th>Vrsta</th>
            <th>Iznos</th>
            <th>Period</th>
            <th>Kamatna stopa</th>
            <th>Rata</th>
            <th>Račun</th>
            <th>Datum</th>
            <th>Akcije</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" style="text-align:center;padding:24px;color:#6b7280">Učitavam...</td>
          </tr>
          <tr v-else-if="requests.length === 0">
            <td colspan="9" style="text-align:center;padding:24px;color:#6b7280">Nema zahteva za kredit.</td>
          </tr>
          <tr
            v-for="loan in requests"
            :key="loan.id"
            class="lr-row"
            @click="selectedLoan = loan"
          >
            <td><code style="font-size:12px">{{ loan.broj_kredita }}</code></td>
            <td>{{ vrstaLabel(loan.vrsta) }}</td>
            <td style="font-weight:600">{{ fmtMoney(loan.iznos) }} RSD</td>
            <td>{{ loan.period }} mes.</td>
            <td>{{ loan.kamatna_stopa?.toFixed(2) }}% ({{ loan.tip_kamate }})</td>
            <td>{{ fmtMoney(loan.iznos_rate) }} RSD</td>
            <td><code style="font-size:12px">{{ loan.broj_racuna }}</code></td>
            <td>{{ fmtDate(loan.datum_kreiranja) }}</td>
            <td>
              <div style="display:flex;gap:6px" @click.stop>
                <button
                  class="btn-success btn-sm"
                  :disabled="actionLoading === loan.id"
                  @click="approve(loan)"
                >
                  Odobri
                </button>
                <button
                  class="btn-danger btn-sm"
                  :disabled="actionLoading === loan.id"
                  @click="reject(loan)"
                >
                  Odbij
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail modal - all client-entered fields -->
    <div v-if="selectedLoan" class="lr-overlay" @click.self="selectedLoan = null">
      <div class="lr-modal">
        <div class="lr-modal-header">
          <h2>Detalji zahteva — {{ selectedLoan.broj_kredita }}</h2>
          <button class="lr-modal-close" @click="selectedLoan = null">✕</button>
        </div>
        <div class="lr-modal-body">
          <div class="lr-grid">
            <div class="lr-item">
              <span class="lr-label">Vrsta kredita</span>
              <span>{{ vrstaLabel(selectedLoan.vrsta) }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Tip kamatne stope</span>
              <span>{{ selectedLoan.tip_kamate === 'fiksna' ? 'Fiksna' : 'Varijabilna' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Iznos kredita</span>
              <span style="font-weight:600">{{ fmtMoney(selectedLoan.iznos) }} RSD</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Svrha kredita</span>
              <span>{{ selectedLoan.svrha_kredita || '—' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Iznos mesečne plate</span>
              <span>{{ selectedLoan.iznos_mesecne_plate ? fmtMoney(selectedLoan.iznos_mesecne_plate) + ' RSD' : '—' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Status zaposlenja</span>
              <span>{{ selectedLoan.status_zaposlenja ? employmentLabel(selectedLoan.status_zaposlenja) : '—' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Period zaposlenja kod poslodavca</span>
              <span>{{ selectedLoan.period_zaposlenja || '—' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Rok otplate</span>
              <span>{{ selectedLoan.period }} meseci</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Kontakt telefon</span>
              <span>{{ selectedLoan.kontakt_telefon || '—' }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Broj računa za isplatu</span>
              <span class="lr-mono">{{ selectedLoan.broj_racuna }}</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Kamatna stopa</span>
              <span>{{ selectedLoan.kamatna_stopa?.toFixed(2) }}%</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Mesečna rata</span>
              <span style="font-weight:600;color:#2563eb">{{ fmtMoney(selectedLoan.iznos_rate) }} RSD</span>
            </div>
            <div class="lr-item">
              <span class="lr-label">Datum podnošenja</span>
              <span>{{ fmtDate(selectedLoan.datum_kreiranja) }}</span>
            </div>
          </div>
        </div>
        <div class="lr-modal-footer">
          <button
            class="btn-success"
            :disabled="actionLoading === selectedLoan.id"
            @click="approve(selectedLoan)"
          >
            Odobri
          </button>
          <button
            class="btn-danger"
            :disabled="actionLoading === selectedLoan.id"
            @click="reject(selectedLoan)"
          >
            Odbij
          </button>
          <button class="btn-secondary" @click="selectedLoan = null">Zatvori</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 22px; font-weight: 700; }
.filters { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
.filters select, .filters input { width: auto; min-width: 180px; }

.lr-row { cursor: pointer; }
.lr-row:hover { background: #f8fafc; }

/* Modal */
.lr-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 20px;
}
.lr-modal {
  background: #fff; border-radius: 12px; width: 100%; max-width: 600px;
  max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.lr-modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px 14px; border-bottom: 1px solid #f1f5f9;
}
.lr-modal-header h2 { font-size: 18px; font-weight: 700; color: #0f172a; }
.lr-modal-close { background: none; border: none; font-size: 18px; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.lr-modal-close:hover { background: #f1f5f9; }
.lr-modal-body { padding: 20px 24px; }
.lr-modal-footer { padding: 14px 24px; border-top: 1px solid #f1f5f9; display: flex; gap: 8px; justify-content: flex-end; }

.lr-grid { display: flex; flex-direction: column; }
.lr-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 0; border-bottom: 1px solid #f8fafc; font-size: 14px;
}
.lr-item:last-child { border-bottom: none; }
.lr-label { color: #64748b; }
.lr-mono { font-family: 'SF Mono', monospace; font-size: 13px; }
</style>
