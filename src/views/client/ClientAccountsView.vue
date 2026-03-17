<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'
import type { ClientAccountItem } from '../../api/clientAccount'

const router = useRouter()
const authStore = useClientAuthStore()
const store = useClientAccountStore()

function statusBadgeClass(status: string) {
  switch (status) {
    case 'aktivan':  return 'badge badge-green'
    case 'blokiran': return 'badge badge-red'
    default:         return 'badge'
  }
}

function tipLabel(tip: string) {
  return tip === 'tekuci' ? 'Tekući' : 'Devizni'
}

function vrstaLabel(vrsta: string) {
  return vrsta === 'licni' ? 'Lični' : 'Poslovni'
}

function formatAmount(amount: number, currency: string) {
  return `${Number(amount).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} ${currency}`
}

function newTransfer(account: ClientAccountItem) {
  router.push({ path: '/client/transfers', query: { fromAccountId: account.id } })
}

function newPayment(account: ClientAccountItem) {
  router.push({ path: '/client/payments', query: { fromAccountId: account.id } })
}

onMounted(() => {
  if (authStore.client?.id) {
    store.fetchAccounts(authStore.client.id)
  }
})
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>My Accounts</h1>
    </div>

    <p v-if="store.error" class="global-error" style="margin-bottom:16px">{{ store.error }}</p>

    <div v-if="store.loading" style="text-align:center;padding:40px;color:#6b7280">
      Loading accounts...
    </div>

    <div v-else-if="store.accounts.length === 0 && !store.loading" style="text-align:center;padding:40px;color:#6b7280">
      No accounts found.
    </div>

    <div v-else style="display:grid;gap:16px">
      <div
        v-for="account in store.accounts"
        :key="account.id"
        class="card account-card"
        style="padding:20px"
      >
        <!-- Header row -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
          <div>
            <div style="font-size:18px;font-weight:600;margin-bottom:4px">
              {{ account.naziv || `${tipLabel(account.tip)} account` }}
            </div>
            <code style="font-size:13px;color:#6b7280">{{ account.brojRacuna }}</code>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;color:#6b7280">{{ tipLabel(account.tip) }} · {{ vrstaLabel(account.vrsta) }}</span>
            <span :class="statusBadgeClass(account.status)">{{ account.status }}</span>
          </div>
        </div>

        <!-- Balance section -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Balance</div>
            <div style="font-size:20px;font-weight:600">{{ formatAmount(account.stanje, account.currencyKod) }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Available</div>
            <div style="font-size:20px;font-weight:600;color:#16a34a">{{ formatAmount(account.raspolozivoStanje, account.currencyKod) }}</div>
          </div>
          <div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:2px">Currency</div>
            <div style="font-size:20px;font-weight:600">{{ account.currencyKod }}</div>
          </div>
        </div>

        <!-- Limits row -->
        <div style="display:flex;gap:24px;font-size:13px;color:#6b7280;margin-bottom:16px">
          <span>Daily limit: <strong style="color:#374151">{{ Number(account.dnevniLimit).toLocaleString('sr-RS') }} {{ account.currencyKod }}</strong></span>
          <span>Monthly limit: <strong style="color:#374151">{{ Number(account.mesecniLimit).toLocaleString('sr-RS') }} {{ account.currencyKod }}</strong></span>
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:10px">
          <button
            class="btn-primary btn-sm"
            :disabled="account.status !== 'aktivan'"
            @click="newTransfer(account)"
          >New Transfer</button>
          <button
            class="btn-secondary btn-sm"
            :disabled="account.status !== 'aktivan'"
            @click="newPayment(account)"
          >New Payment</button>
          <button
            class="btn-secondary btn-sm"
            @click="router.push({ path: '/client/transfers', query: { accountId: account.id } })"
          >View Transactions</button>
        </div>
      </div>
    </div>
  </div>
</template>
