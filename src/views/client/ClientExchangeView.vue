<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { exchangeApi, type ExchangeRate } from '../../api/exchange'
import { CURRENCIES } from '../../api/account'

const rates = ref<ExchangeRate[]>([])
const loadingRates = ref(false)
const ratesError = ref('')

const calcFrom = ref('EUR')
const calcTo = ref('RSD')
const calcAmount = ref('')
const calcResult = ref<{ outputAmount: number; rate: number } | null>(null)
const loadingCalc = ref(false)
const calcError = ref('')

async function loadRates() {
  loadingRates.value = true
  ratesError.value = ''
  try {
    const res = await exchangeApi.getRates()
    rates.value = res.data.rates ?? []
  } catch (e: any) {
    ratesError.value = e.response?.data?.message || 'Failed to load rates.'
  } finally {
    loadingRates.value = false
  }
}

async function calculate() {
  if (!calcFrom.value || !calcTo.value || !calcAmount.value || Number(calcAmount.value) <= 0) return
  loadingCalc.value = true
  calcError.value = ''
  calcResult.value = null
  try {
    const res = await exchangeApi.calculate(calcFrom.value, calcTo.value, Number(calcAmount.value))
    calcResult.value = {
      outputAmount: res.data.output_amount ?? 0,
      rate: res.data.rate ?? 0,
    }
  } catch (e: any) {
    calcError.value = e.response?.data?.message || 'Failed to calculate.'
  } finally {
    loadingCalc.value = false
  }
}

onMounted(loadRates)
</script>

<template>
  <div class="page-container">
    <h1 class="page-title">Menjačnica</h1>

    <!-- Exchange Rate List -->
    <div class="card mb-6">
      <div class="card-header">
        <h2>Kursna lista</h2>
      </div>
      <div class="card-body">
        <div v-if="loadingRates" class="loading-msg">Učitavam kurseve...</div>
        <div v-else-if="ratesError" class="error-message">{{ ratesError }}</div>
        <div v-else-if="rates.length === 0" class="empty-msg">Nema dostupnih kurseva.</div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Iz valute</th>
              <th>U valutu</th>
              <th>Kurs</th>
              <th>Inverzni kurs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rates" :key="`${r.from}-${r.to}`">
              <td>{{ r.from }}</td>
              <td>{{ r.to }}</td>
              <td>{{ r.rate.toFixed(4) }}</td>
              <td>{{ r.rate > 0 ? (1 / r.rate).toFixed(4) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Calculator -->
    <div class="card">
      <div class="card-header">
        <h2>Kalkulator konverzije</h2>
      </div>
      <div class="card-body">
        <div class="calc-row">
          <div class="form-group">
            <label>Iz valute</label>
            <select v-model="calcFrom" class="form-input">
              <option v-for="c in CURRENCIES" :key="c.id" :value="c.kod">{{ c.kod }} — {{ c.naziv }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>U valutu</label>
            <select v-model="calcTo" class="form-input">
              <option v-for="c in CURRENCIES" :key="c.id" :value="c.kod">{{ c.kod }} — {{ c.naziv }}</option>
            </select>
          </div>

          <div class="form-group">
            <label>Iznos</label>
            <input v-model="calcAmount" type="number" min="0.01" step="0.01" class="form-input" placeholder="0.00" />
          </div>

          <div class="form-group form-group-btn">
            <button
              class="btn btn-primary"
              :disabled="loadingCalc || !calcAmount || Number(calcAmount) <= 0"
              @click="calculate"
            >
              {{ loadingCalc ? 'Računam...' : 'Izračunaj' }}
            </button>
          </div>
        </div>

        <div v-if="calcError" class="error-message">{{ calcError }}</div>

        <div v-if="calcResult" class="calc-result">
          <span class="calc-result-main">
            {{ Number(calcAmount).toLocaleString('sr-RS') }} {{ calcFrom }}
            =
            {{ calcResult.outputAmount.toLocaleString('sr-RS') }} {{ calcTo }}
          </span>
          <span class="calc-result-rate">Kurs: 1 {{ calcFrom }} = {{ calcResult.rate.toFixed(4) }} {{ calcTo }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
