<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

// Group rates by base currency, show only vs RSD for compact display
const rsdRates = computed(() =>
  rates.value.filter(r => r.to === 'RSD' && r.from !== 'RSD')
)

async function loadRates() {
  loadingRates.value = true
  ratesError.value = ''
  try {
    const res = await exchangeApi.getRates()
    rates.value = res.data.rates ?? []
  } catch (e: any) {
    ratesError.value = e.response?.data?.message || 'Greška pri učitavanju kurseva.'
  } finally {
    loadingRates.value = false
  }
}

async function calculate() {
  if (!calcFrom.value || !calcTo.value || !calcAmount.value || Number(calcAmount.value) <= 0) return
  if (calcFrom.value === calcTo.value) {
    calcResult.value = { outputAmount: Number(calcAmount.value), rate: 1 }
    return
  }
  loadingCalc.value = true
  calcError.value = ''
  calcResult.value = null
  try {
    const res = await exchangeApi.calculate(calcFrom.value, calcTo.value, Number(calcAmount.value))
    calcResult.value = {
      outputAmount: res.data.outputAmount ?? res.data.output_amount ?? 0,
      rate: res.data.rate ?? 0,
    }
  } catch (e: any) {
    calcError.value = e.response?.data?.message || 'Greška pri konverziji.'
  } finally {
    loadingCalc.value = false
  }
}

function swapCurrencies() {
  const tmp = calcFrom.value
  calcFrom.value = calcTo.value
  calcTo.value = tmp
  calcResult.value = null
}

onMounted(loadRates)
</script>

<template>
  <div class="exchange-page">
    <h1 class="ex-title">Menjačnica</h1>

    <div class="ex-grid">
      <!-- Calculator -->
      <div class="ex-card ex-card-primary">
        <h2 class="ex-card-title">Kalkulator konverzije</h2>

        <div class="ex-calc-row">
          <div class="ex-field">
            <label>Iz valute</label>
            <select v-model="calcFrom">
              <option v-for="c in CURRENCIES" :key="c.id" :value="c.kod">{{ c.kod }}</option>
            </select>
          </div>

          <button class="ex-swap" @click="swapCurrencies" title="Zameni valute">⇄</button>

          <div class="ex-field">
            <label>U valutu</label>
            <select v-model="calcTo">
              <option v-for="c in CURRENCIES" :key="c.id" :value="c.kod">{{ c.kod }}</option>
            </select>
          </div>
        </div>

        <div class="ex-field" style="margin-bottom:16px">
          <label>Iznos</label>
          <input
            v-model="calcAmount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Unesite iznos"
            @keyup.enter="calculate"
          />
        </div>

        <button
          class="ex-btn"
          :disabled="loadingCalc || !calcAmount || Number(calcAmount) <= 0 || calcFrom === calcTo"
          @click="calculate"
        >
          {{ loadingCalc ? 'Računam...' : 'Izračunaj' }}
        </button>

        <div v-if="calcError" class="ex-error">{{ calcError }}</div>

        <div v-if="calcResult" class="ex-result">
          <div class="ex-result-amount">
            {{ Number(calcAmount).toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} {{ calcFrom }}
          </div>
          <div class="ex-result-equals">=</div>
          <div class="ex-result-converted">
            {{ calcResult.outputAmount.toLocaleString('sr-RS', { minimumFractionDigits: 2 }) }} {{ calcTo }}
          </div>
          <div class="ex-result-rate">
            Kurs: 1 {{ calcFrom }} = {{ calcResult.rate.toFixed(4) }} {{ calcTo }}
          </div>
        </div>
      </div>

      <!-- Rate list -->
      <div class="ex-card">
        <h2 class="ex-card-title">Kursna lista (prema RSD)</h2>

        <div v-if="loadingRates" class="ex-empty">Učitavam...</div>
        <div v-else-if="ratesError" class="ex-error">{{ ratesError }}</div>
        <div v-else-if="rsdRates.length === 0" class="ex-empty">Nema dostupnih kurseva.</div>
        <div v-else class="ex-rates">
          <div v-for="r in rsdRates" :key="r.from" class="ex-rate-row">
            <div class="ex-rate-currency">
              <span class="ex-rate-code">{{ r.from }}</span>
            </div>
            <div class="ex-rate-values">
              <div class="ex-rate-buy">{{ r.rate.toFixed(2) }} RSD</div>
              <div class="ex-rate-inv">1 RSD = {{ (1 / r.rate).toFixed(6) }} {{ r.from }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exchange-page {
  padding: 32px;
  max-width: 1000px;
  margin: 0 auto;
}
.ex-title {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 24px;
}
.ex-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.ex-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
}
.ex-card-primary {
  background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
  color: #fff;
  border: none;
}
.ex-card-primary label { color: rgba(255,255,255,0.7); }
.ex-card-primary select,
.ex-card-primary input {
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
}
.ex-card-primary select option { color: #1e293b; }
.ex-card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 20px;
}
.ex-calc-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}
.ex-calc-row .ex-field { flex: 1; }
.ex-swap {
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  font-size: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 2px;
}
.ex-swap:hover { background: rgba(255,255,255,0.25); }
.ex-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ex-field label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.ex-field select,
.ex-field input {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
}
.ex-btn {
  width: 100%;
  padding: 12px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.ex-btn:hover:not(:disabled) { background: rgba(255,255,255,0.3); }
.ex-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ex-error {
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(239,68,68,0.15);
  color: #fca5a5;
  border-radius: 6px;
  font-size: 13px;
}
.ex-result {
  margin-top: 20px;
  text-align: center;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
}
.ex-result-amount {
  font-size: 16px;
  color: rgba(255,255,255,0.7);
}
.ex-result-equals {
  font-size: 20px;
  margin: 4px 0;
  color: rgba(255,255,255,0.5);
}
.ex-result-converted {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}
.ex-result-rate {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  margin-top: 8px;
}

/* Rate list */
.ex-rates {
  display: flex;
  flex-direction: column;
}
.ex-rate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}
.ex-rate-row:last-child { border-bottom: none; }
.ex-rate-code {
  font-weight: 700;
  font-size: 15px;
  color: #1e293b;
}
.ex-rate-values { text-align: right; }
.ex-rate-buy {
  font-weight: 600;
  color: #0f172a;
  font-size: 15px;
}
.ex-rate-inv {
  font-size: 12px;
  color: #94a3b8;
}
.ex-empty {
  text-align: center;
  color: #94a3b8;
  padding: 24px;
}

@media (max-width: 768px) {
  .ex-grid { grid-template-columns: 1fr; }
}
</style>
