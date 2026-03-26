<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLoanStore } from '../../stores/loan'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { loanApi, LOAN_STATUS_LABELS, type Loan, type LoanInstallment } from '../../api/loan'

const router = useRouter()
const clientAuth = useClientAuthStore()
const loanStore = useLoanStore()
const accountStore = useClientAccountStore()

const clientId = computed(() => clientAuth.client?.id ?? '')

const selectedLoan = ref<Loan | null>(null)
const selectedInstallments = ref<LoanInstallment[]>([])
const installmentsLoading = ref(false)

// Computed: remaining debt = sum of unpaid installments
const remainingDebt = computed(() => {
  return selectedInstallments.value
    .filter(i => i.status === 'ocekuje' || i.status === 'kasni')
    .reduce((sum, i) => sum + i.iznos, 0)
})

// Computed: next installment (earliest unpaid)
const nextInstallment = computed(() => {
  const unpaid = selectedInstallments.value
    .filter(i => i.status === 'ocekuje')
    .sort((a, b) => new Date(a.datum_dospeca).getTime() - new Date(b.datum_dospeca).getTime())
  return unpaid.length > 0 ? unpaid[0] : null
})

// Computed: effective interest rate (current rate from latest installment snapshot)
const effectiveRate = computed(() => {
  const loan = selectedLoan.value
  if (!loan) return null
  if (loan.tip_kamate === 'fiksna') return loan.kamatna_stopa
  // For variable rate, use the latest installment's snapshot
  const unpaid = selectedInstallments.value
    .filter(i => i.status === 'ocekuje')
    .sort((a, b) => new Date(a.datum_dospeca).getTime() - new Date(b.datum_dospeca).getTime())
  const first = unpaid[0]
  if (first) return first.kamata_stopa_snapshot
  // fallback to loan's rate
  return loan.kamatna_stopa
})

// Computed: currency label from account
const loanCurrency = computed(() => {
  const loan = selectedLoan.value
  if (!loan) return 'RSD'
  const acc = accountStore.accounts.find(a => a.brojRacuna === loan.broj_racuna)
  return acc?.currencyKod ?? 'RSD'
})

const sortedLoans = computed(() =>
  [...loanStore.loans].sort((a, b) => b.iznos - a.iznos)
)

async function openLoan(loan: Loan) {
  selectedLoan.value = loan
  selectedInstallments.value = []
  installmentsLoading.value = true
  try {
    const res = await loanApi.listInstallments(loan.id)
    selectedInstallments.value = res.data ?? []
  } catch {
    selectedInstallments.value = []
  } finally {
    installmentsLoading.value = false
  }
}

function closeModal() {
  selectedLoan.value = null
  selectedInstallments.value = []
}

function vrstaLabel(v: string) {
  const map: Record<string, string> = {
    gotovinski: 'Gotovinski',
    stambeni: 'Stambeni',
    auto: 'Auto',
    refinansirajuci: 'Refinansirajući',
    studentski: 'Studentski',
  }
  return map[v] ?? v
}

function statusClass(s: string) {
  switch (s) {
    case 'aktivan':  return 'badge-active'
    case 'odobren':  return 'badge-approved'
    case 'zahtev':   return 'badge-pending'
    case 'odbijen':  return 'badge-rejected'
    case 'zatvoren': return 'badge-closed'
    default: return 'badge-closed'
  }
}

function installmentStatusClass(s: string) {
  switch (s) {
    case 'placena': return 'inst-paid'
    case 'kasni':   return 'inst-late'
    default:        return 'inst-pending'
  }
}

function installmentStatusLabel(s: string) {
  return { placena: 'Plaćena', kasni: 'Kasni', ocekuje: 'Očekuje' }[s] ?? s
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS')
}

function fmtMoney(n: number) {
  return n.toLocaleString('sr-RS', { minimumFractionDigits: 2 })
}

onMounted(async () => {
  if (clientId.value) {
    await Promise.all([
      loanStore.fetchByClient(clientId.value),
      accountStore.fetchAccounts(String(clientId.value)),
    ])
  }
})
</script>

<template>
  <div class="lv-page">
    <div class="lv-header">
      <div>
        <h1 class="lv-title">Moji krediti</h1>
        <p class="lv-subtitle">Pregled svih vaših kredita</p>
      </div>
      <button class="lv-btn lv-btn-primary" @click="router.push('/client/loans/new')">
        + Zahtev za kredit
      </button>
    </div>

    <div v-if="loanStore.loading" class="lv-empty">Učitavam...</div>
    <div v-else-if="loanStore.error" class="lv-error">{{ loanStore.error }}</div>
    <div v-else-if="sortedLoans.length === 0" class="lv-empty-state">
      <div class="lv-empty-icon">🏦</div>
      <h3>Nemate aktivnih kredita</h3>
      <p>Podnesite zahtev za kredit da biste počeli.</p>
      <button class="lv-btn lv-btn-primary" @click="router.push('/client/loans/new')">
        + Zahtev za kredit
      </button>
    </div>

    <div v-else class="lv-list">
      <div
        v-for="loan in sortedLoans"
        :key="loan.id"
        class="lv-card"
        @click="openLoan(loan)"
      >
        <div class="lv-card-left">
          <div class="lv-card-icon">💳</div>
          <div class="lv-card-info">
            <div class="lv-card-name">{{ vrstaLabel(loan.vrsta) }} kredit</div>
            <div class="lv-card-meta">
              {{ loan.broj_kredita }} · {{ loan.period }} mes. · {{ loan.tip_kamate }}
            </div>
          </div>
        </div>
        <div class="lv-card-right">
          <div class="lv-card-amount">{{ fmtMoney(loan.iznos) }} {{ accountStore.accounts.find(a => a.brojRacuna === loan.broj_racuna)?.currencyKod ?? 'RSD' }}</div>
          <div class="lv-card-rate">Rata: {{ fmtMoney(loan.iznos_rate) }} {{ accountStore.accounts.find(a => a.brojRacuna === loan.broj_racuna)?.currencyKod ?? 'RSD' }}/mes</div>
          <span :class="['lv-badge', statusClass(loan.status)]">
            {{ LOAN_STATUS_LABELS[loan.status] ?? loan.status }}
          </span>
        </div>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="selectedLoan" class="lv-overlay" @click.self="closeModal">
      <div class="lv-modal">
        <div class="lv-modal-header">
          <div>
            <h2>{{ vrstaLabel(selectedLoan.vrsta) }} kredit</h2>
            <span :class="['lv-badge', statusClass(selectedLoan.status)]">
              {{ LOAN_STATUS_LABELS[selectedLoan.status] ?? selectedLoan.status }}
            </span>
          </div>
          <button class="lv-modal-close" @click="closeModal">✕</button>
        </div>

        <div class="lv-modal-body">
          <div class="lv-detail-grid">
            <div class="lv-detail-item">
              <span class="lv-detail-label">Broj kredita</span>
              <span class="lv-mono">{{ selectedLoan.broj_kredita }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Vrsta kredita</span>
              <span>{{ vrstaLabel(selectedLoan.vrsta) }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Ukupni iznos kredita</span>
              <span>{{ fmtMoney(selectedLoan.iznos) }} {{ loanCurrency }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Period otplate</span>
              <span>{{ selectedLoan.period }} meseci</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Nominalna kamatna stopa</span>
              <span>{{ selectedLoan.kamatna_stopa?.toFixed(2) }}% ({{ selectedLoan.tip_kamate }})</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Efektivna kamatna stopa</span>
              <span>{{ effectiveRate?.toFixed(2) }}%</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Datum ugovaranja</span>
              <span>{{ fmtDate(selectedLoan.datum_kreiranja) }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Datum kada kredit treba da bude isplaćen</span>
              <span>{{ fmtDate(selectedLoan.datum_dospeca) }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Iznos sledeće rate</span>
              <span class="lv-highlight">
                {{ nextInstallment ? fmtMoney(nextInstallment.iznos) + ' ' + loanCurrency : '—' }}
              </span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Datum sledeće rate</span>
              <span>{{ nextInstallment ? fmtDate(nextInstallment.datum_dospeca) : '—' }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Preostalo dugovanje</span>
              <span class="lv-highlight">{{ fmtMoney(remainingDebt) }} {{ loanCurrency }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Valuta kredita</span>
              <span>{{ loanCurrency }}</span>
            </div>
            <div class="lv-detail-item">
              <span class="lv-detail-label">Račun za naplatu</span>
              <span class="lv-mono">{{ selectedLoan.broj_racuna }}</span>
            </div>
          </div>

          <!-- Installments table -->
          <div class="lv-inst-section">
            <h3 class="lv-inst-title">Raspored rata</h3>
            <div v-if="installmentsLoading" class="lv-empty">Učitavam rate...</div>
            <div v-else-if="selectedInstallments.length === 0" class="lv-empty">
              Nema podataka o ratama.
            </div>
            <div v-else class="lv-inst-table-wrap">
              <table class="lv-inst-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Iznos</th>
                    <th>Datum dospeća</th>
                    <th>Datum plaćanja</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="inst in selectedInstallments" :key="inst.id">
                    <td>{{ inst.redni_broj }}</td>
                    <td>{{ fmtMoney(inst.iznos) }}</td>
                    <td>{{ fmtDate(inst.datum_dospeca) }}</td>
                    <td>{{ fmtDate(inst.datum_placanja) }}</td>
                    <td>
                      <span :class="['lv-inst-badge', installmentStatusClass(inst.status)]">
                        {{ installmentStatusLabel(inst.status) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="lv-modal-footer">
          <button class="lv-btn lv-btn-sec" @click="closeModal">Zatvori</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lv-page { padding: 32px; max-width: 900px; margin: 0 auto; }
.lv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
.lv-title { font-size: 28px; font-weight: 700; color: #0f172a; }
.lv-subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }

.lv-btn { padding: 10px 20px; border-radius: 10px; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: all 0.15s; }
.lv-btn-primary { background: #2563eb; color: #fff; }
.lv-btn-primary:hover { background: #1d4ed8; }
.lv-btn-sec { background: #f1f5f9; color: #475569; }
.lv-btn-sec:hover { background: #e2e8f0; }

.lv-list { display: flex; flex-direction: column; gap: 10px; }
.lv-card {
  display: flex; justify-content: space-between; align-items: center;
  background: #fff; border-radius: 14px; padding: 20px 24px;
  border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  cursor: pointer; transition: all 0.15s;
}
.lv-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.09); border-color: #bfdbfe; }
.lv-card-left { display: flex; align-items: center; gap: 16px; }
.lv-card-icon { font-size: 28px; }
.lv-card-name { font-weight: 700; font-size: 16px; color: #1e293b; }
.lv-card-meta { font-size: 12px; color: #94a3b8; margin-top: 3px; }
.lv-card-right { text-align: right; }
.lv-card-amount { font-weight: 700; font-size: 18px; color: #0f172a; }
.lv-card-rate { font-size: 12px; color: #64748b; margin-top: 2px; }

.lv-badge {
  display: inline-block; padding: 3px 10px; border-radius: 20px;
  font-size: 11px; font-weight: 700; margin-top: 5px;
}
.badge-active   { background: #dcfce7; color: #166534; }
.badge-approved { background: #dbeafe; color: #1d4ed8; }
.badge-pending  { background: #fef9c3; color: #854d0e; }
.badge-rejected { background: #fee2e2; color: #991b1b; }
.badge-closed   { background: #f1f5f9; color: #475569; }

.lv-empty { text-align: center; padding: 40px; color: #94a3b8; }
.lv-error { padding: 12px 16px; background: #fef2f2; color: #dc2626; border-radius: 8px; margin-bottom: 16px; }
.lv-empty-state {
  text-align: center; padding: 60px 20px;
  background: #fff; border-radius: 16px; border: 1px solid #e2e8f0;
}
.lv-empty-icon { font-size: 48px; margin-bottom: 12px; }
.lv-empty-state h3 { font-size: 18px; color: #1e293b; margin-bottom: 4px; }
.lv-empty-state p { color: #64748b; font-size: 14px; margin-bottom: 20px; }

/* Modal */
.lv-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 20px;
}
.lv-modal {
  background: #fff; border-radius: 16px; width: 100%; max-width: 700px; max-height: 90vh;
  overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.lv-modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 24px 28px 16px; border-bottom: 1px solid #f1f5f9; position: sticky; top: 0; background: #fff;
}
.lv-modal-header h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.lv-modal-close { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.lv-modal-close:hover { background: #f1f5f9; }
.lv-modal-body { padding: 24px 28px; }
.lv-modal-footer { padding: 16px 28px; border-top: 1px solid #f1f5f9; }

.lv-detail-grid { display: flex; flex-direction: column; gap: 0; }
.lv-detail-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 11px 0; border-bottom: 1px solid #f8fafc; font-size: 14px;
}
.lv-detail-item:last-child { border-bottom: none; }
.lv-detail-label { color: #64748b; }
.lv-mono { font-family: 'SF Mono', monospace; font-size: 13px; }
.lv-highlight { font-weight: 700; color: #2563eb; }

/* Installments */
.lv-inst-section { margin-top: 24px; }
.lv-inst-title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }
.lv-inst-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #e2e8f0; }
.lv-inst-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.lv-inst-table th {
  background: #f8fafc; color: #64748b; font-weight: 600; font-size: 11px; text-transform: uppercase;
  padding: 10px 14px; text-align: left; border-bottom: 1px solid #e2e8f0;
}
.lv-inst-table td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
.lv-inst-table tr:last-child td { border-bottom: none; }
.lv-inst-badge {
  display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;
}
.inst-paid    { background: #dcfce7; color: #166534; }
.inst-late    { background: #fee2e2; color: #991b1b; }
.inst-pending { background: #fef9c3; color: #854d0e; }
</style>
