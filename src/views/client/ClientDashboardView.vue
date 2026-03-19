<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import { useTransferStore } from '../../stores/transfer'
import { usePaymentStore } from '../../stores/payment'
import { useRecipientStore } from '../../stores/recipient'
import { exchangeApi, type ExchangeRate } from '../../api/exchange'

const clientAuthStore = useClientAuthStore()
const accountStore = useClientAccountStore()
const transferStore = useTransferStore()
const paymentStore = usePaymentStore()
const recipientStore = useRecipientStore()

const clientId = computed(() => String(clientAuthStore.client?.id ?? ''))

const rates = ref<ExchangeRate[]>([])
const loadingRates = ref(false)

const recentActivity = computed(() => {
  const items = [
    ...transferStore.transfers.map(t => ({
      type: 'transfer' as const,
      id: t.id,
      date: t.vremeTransakcije,
      amount: t.iznos,
      currency: t.valutaIznosa,
      description: t.svrha || 'Transfer',
      status: t.status,
    })),
    ...paymentStore.payments.map(p => ({
      type: 'payment' as const,
      id: p.id,
      date: p.vremeTransakcije,
      amount: p.iznos,
      currency: '',
      description: p.svrha || 'Plaćanje',
      status: p.status,
    })),
  ]
  return items
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
})

const topRecipients = computed(() => recipientStore.recipients.slice(0, 5))

const totalBalance = computed(() => {
  return accountStore.accounts
    .filter(a => a.currencyKod === 'RSD')
    .reduce((sum, a) => sum + a.stanje, 0)
})

function statusClass(status: string) {
  switch (status) {
    case 'uspesno': return 'status-success'
    case 'neuspesno': return 'status-error'
    case 'u_obradi': return 'status-pending'
    default: return 'status-neutral'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'uspesno': return 'Uspešno'
    case 'neuspesno': return 'Neuspešno'
    case 'u_obradi': return 'U obradi'
    case 'stornirano': return 'Stornirano'
    default: return status
  }
}

async function loadRates() {
  loadingRates.value = true
  try {
    const res = await exchangeApi.getRates()
    rates.value = (res.data.rates ?? []).slice(0, 6)
  } catch {
    rates.value = []
  } finally {
    loadingRates.value = false
  }
}

onMounted(async () => {
  if (!clientId.value) return
  await Promise.all([
    accountStore.fetchAccounts(clientId.value),
    transferStore.fetchByClient(clientId.value),
    paymentStore.fetchByClient(clientId.value),
    recipientStore.fetchRecipients(clientId.value),
    loadRates(),
  ])
})
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dobrodošli, {{ clientAuthStore.client?.ime }}!</h1>
        <p class="dash-subtitle">Pregled vašeg finansijskog stanja</p>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="stats-row">
      <div class="stat-card stat-primary">
        <div class="stat-label">Ukupno stanje (RSD)</div>
        <div class="stat-value">{{ totalBalance.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Broj računa</div>
        <div class="stat-value">{{ accountStore.accounts.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Transakcije</div>
        <div class="stat-value">{{ transferStore.transfers.length + paymentStore.payments.length }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Primaoci</div>
        <div class="stat-value">{{ recipientStore.recipients.length }}</div>
      </div>
    </div>

    <!-- Accounts -->
    <div class="section">
      <div class="section-header">
        <h2>Moji računi</h2>
        <RouterLink to="/client/accounts" class="section-link">Svi računi →</RouterLink>
      </div>
      <div v-if="accountStore.loading" class="empty-state">Učitavam...</div>
      <div v-else-if="accountStore.accounts.length === 0" class="empty-state">Nemate račune.</div>
      <div v-else class="accounts-grid">
        <div v-for="acc in accountStore.accounts" :key="acc.id" class="account-card">
          <div class="acc-top">
            <span class="acc-currency-badge">{{ acc.currencyKod }}</span>
            <span class="acc-type">{{ acc.tip === 'tekuci' ? 'Tekući' : 'Devizni' }}</span>
          </div>
          <div class="acc-name">{{ acc.naziv || 'Račun' }}</div>
          <div class="acc-number">{{ acc.brojRacuna }}</div>
          <div class="acc-balance">{{ acc.stanje.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }}</div>
          <div class="acc-available">Raspoloživo: {{ acc.raspolozivoStanje.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} {{ acc.currencyKod }}</div>
        </div>
      </div>
    </div>

    <!-- Two column layout -->
    <div class="two-col">
      <!-- Recent activity -->
      <div class="section">
        <div class="section-header">
          <h2>Poslednje transakcije</h2>
          <RouterLink to="/client/transfers" class="section-link">Sve →</RouterLink>
        </div>
        <div v-if="recentActivity.length === 0" class="empty-state">Nema transakcija.</div>
        <div v-else class="activity-list">
          <div v-for="item in recentActivity" :key="item.id + item.type" class="activity-item">
            <div class="activity-icon" :class="item.type === 'transfer' ? 'icon-transfer' : 'icon-payment'">
              {{ item.type === 'transfer' ? '⇄' : '▤' }}
            </div>
            <div class="activity-info">
              <div class="activity-desc">{{ item.description }}</div>
              <div class="activity-date">{{ new Date(item.date).toLocaleDateString('sr-RS') }}</div>
            </div>
            <div class="activity-right">
              <div class="activity-amount">{{ item.amount.toLocaleString('sr-RS') }} {{ item.currency }}</div>
              <span :class="['status-badge', statusClass(item.status)]">{{ statusLabel(item.status) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Exchange rates -->
      <div class="section">
        <div class="section-header">
          <h2>Kursna lista</h2>
          <RouterLink to="/client/exchange" class="section-link">Menjačnica →</RouterLink>
        </div>
        <div v-if="loadingRates" class="empty-state">Učitavam...</div>
        <div v-else-if="rates.length === 0" class="empty-state">Kursevi nisu dostupni.</div>
        <div v-else class="rates-list">
          <div v-for="r in rates" :key="`${r.from}-${r.to}`" class="rate-item">
            <div class="rate-pair">
              <span class="rate-from">{{ r.from }}</span>
              <span class="rate-arrow">→</span>
              <span class="rate-to">{{ r.to }}</span>
            </div>
            <div class="rate-value">{{ r.rate.toFixed(4) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom row -->
    <div class="two-col">
      <!-- Recipients -->
      <div class="section">
        <div class="section-header">
          <h2>Primaoci</h2>
          <RouterLink to="/client/recipients" class="section-link">Svi →</RouterLink>
        </div>
        <div v-if="topRecipients.length === 0" class="empty-state">Nema sačuvanih primalaca.</div>
        <div v-else class="recipients-grid">
          <div v-for="r in topRecipients" :key="r.id" class="recipient-card">
            <div class="recipient-avatar">{{ r.naziv.charAt(0) }}</div>
            <div class="recipient-info">
              <div class="recipient-name">{{ r.naziv }}</div>
              <div class="recipient-account">{{ r.brojRacuna }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="section">
        <div class="section-header">
          <h2>Brze akcije</h2>
        </div>
        <div class="quick-actions">
          <RouterLink to="/client/transfers" class="action-btn">
            <span class="action-icon">⇄</span>
            <span>Novi transfer</span>
          </RouterLink>
          <RouterLink to="/client/payments/new" class="action-btn">
            <span class="action-icon">▤</span>
            <span>Novo plaćanje</span>
          </RouterLink>
          <RouterLink to="/client/exchange" class="action-btn">
            <span class="action-icon">↻</span>
            <span>Menjačnica</span>
          </RouterLink>
          <RouterLink to="/client/recipients" class="action-btn">
            <span class="action-icon">◉</span>
            <span>Primaoci</span>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.dash-header {
  margin-bottom: 28px;
}
.dash-title {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
}
.dash-subtitle {
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}
.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
}
.stat-card.stat-primary {
  background: linear-gradient(135deg, #1e3a5f, #2563eb);
  color: #fff;
  border: none;
}
.stat-card.stat-primary .stat-label { color: rgba(255,255,255,0.7); }
.stat-card.stat-primary .stat-value { color: #fff; }
.stat-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 4px;
}

/* Sections */
.section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.section-header h2 {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.section-link {
  font-size: 13px;
  color: #3b82f6;
  font-weight: 500;
  text-decoration: none;
}
.section-link:hover { text-decoration: underline; }

/* Two column */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* Accounts */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.account-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
  transition: box-shadow 0.15s;
}
.account-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.acc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.acc-currency-badge {
  background: #eff6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}
.acc-type {
  font-size: 11px;
  color: #94a3b8;
}
.acc-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 15px;
}
.acc-number {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
  font-family: 'SF Mono', monospace;
}
.acc-balance {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 12px;
}
.acc-available {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

/* Activity */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.activity-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}
.activity-item:last-child { border-bottom: none; }
.activity-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.icon-transfer { background: #eff6ff; color: #2563eb; }
.icon-payment { background: #f0fdf4; color: #16a34a; }
.activity-info { flex: 1; min-width: 0; }
.activity-desc {
  font-weight: 500;
  color: #1e293b;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.activity-date { font-size: 12px; color: #94a3b8; }
.activity-right { text-align: right; }
.activity-amount {
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
}
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.status-success { background: #dcfce7; color: #166534; }
.status-error { background: #fee2e2; color: #991b1b; }
.status-pending { background: #fef9c3; color: #854d0e; }
.status-neutral { background: #f1f5f9; color: #475569; }

/* Rates */
.rates-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rate-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.rate-item:last-child { border-bottom: none; }
.rate-pair {
  display: flex;
  align-items: center;
  gap: 6px;
}
.rate-from { font-weight: 600; color: #1e293b; }
.rate-arrow { color: #94a3b8; font-size: 12px; }
.rate-to { color: #64748b; }
.rate-value {
  font-weight: 600;
  color: #0f172a;
  font-family: 'SF Mono', monospace;
}

/* Recipients */
.recipients-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.recipient-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.recipient-card:last-child { border-bottom: none; }
.recipient-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #475569;
  flex-shrink: 0;
}
.recipient-info { min-width: 0; }
.recipient-name { font-weight: 500; color: #1e293b; font-size: 14px; }
.recipient-account { font-size: 12px; color: #94a3b8; font-family: 'SF Mono', monospace; }

/* Quick actions */
.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.15s;
}
.action-btn:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  text-decoration: none;
}
.action-icon {
  font-size: 22px;
}

/* Empty state */
.empty-state {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

@media (max-width: 900px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; }
}
</style>
