<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { employeeApi } from '../api/employee'
import { usePermissions } from '../composables/usePermissions'
import { useAuthStore } from '../stores/auth'
import EditEmployeeDialog from '../components/EditEmployeeDialog.vue'
import CreateEmployeeDialog from '../components/CreateEmployeeDialog.vue'

interface EmployeeListItem {
  id: string; ime: string; prezime: string; email: string
  pozicija: string; brojTelefona: string; aktivan: boolean
  permissionNames: string[]
}
interface EmployeeDetail {
  id: string; ime: string; prezime: string; datumRodjenja: string
  pol: string; email: string; brojTelefona: string; adresa: string
  username: string; pozicija: string; departman: string; aktivan: boolean
  permissions: { id: string; name: string; description: string }[]
}
interface Permission { id: string; name: string; description: string }

const perms = usePermissions()
const auth = useAuthStore()

const employees = ref<EmployeeListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const allPermissions = ref<Permission[]>([])

const filterEmail = ref('')
const filterName = ref('')
const filterPozicija = ref('')

const showCreate = ref(false)
const editingEmployee = ref<EmployeeDetail | null>(null)

const loading = ref(false)
const error = ref('')

async function fetchEmployees() {
  loading.value = true
  error.value = ''
  try {
    const res = await employeeApi.list({
      emailFilter:    filterEmail.value || undefined,
      nameFilter:     filterName.value || undefined,
      pozicijaFilter: filterPozicija.value || undefined,
      page:     page.value,
      pageSize,
    })
    employees.value = res.data.employees ?? []
    total.value = Number(res.data.total ?? 0)
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Failed to load employees.'
  } finally {
    loading.value = false
  }
}

async function fetchPermissions() {
  try {
    const res = await employeeApi.getAllPermissions()
    allPermissions.value = res.data.permissions ?? []
  } catch {}
}

async function openEdit(emp: EmployeeListItem) {
  try {
    const res = await employeeApi.get(emp.id)
    editingEmployee.value = res.data.employee
  } catch (e: any) {
    error.value = 'Failed to load employee details.'
  }
}

async function toggleActive(emp: EmployeeListItem) {
  try {
    await employeeApi.setActive(emp.id, !emp.aktivan)
    await fetchEmployees()
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Failed to update status.'
  }
}

function onCreated() {
  showCreate.value = false
  fetchEmployees()
}

function onSaved() {
  editingEmployee.value = null
  fetchEmployees()
}

function applyFilters() {
  page.value = 1
  fetchEmployees()
}

function clearFilters() {
  filterEmail.value = ''
  filterName.value = ''
  filterPozicija.value = ''
  page.value = 1
  fetchEmployees()
}

function isAdmin(emp: EmployeeListItem): boolean {
  return emp.permissionNames.includes('admin')
}

const currentEmployeeId = computed(() => auth.employee?.id ?? null)

function canToggleActive(emp: EmployeeListItem): boolean {
  return perms.canActivate() && !isAdmin(emp) && emp.id !== currentEmployeeId.value
}

const totalPages = () => Math.ceil(total.value / pageSize)

onMounted(() => {
  fetchEmployees()
  fetchPermissions()
})
</script>

<template>
  <div class="page-content">
    <div class="page-header">
      <h1>Employees</h1>
      <button v-if="perms.canCreate()" class="btn-primary" @click="showCreate = true">
        + Create Employee
      </button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="filterEmail"    placeholder="Filter by email"    @keyup.enter="applyFilters" />
      <input v-model="filterName"     placeholder="Filter by name"     @keyup.enter="applyFilters" />
      <input v-model="filterPozicija" placeholder="Filter by position" @keyup.enter="applyFilters" />
      <button class="btn-primary" @click="applyFilters">Search</button>
      <button class="btn-secondary" @click="clearFilters">Clear</button>
    </div>

    <p v-if="error" class="global-error" style="margin-bottom:12px">{{ error }}</p>

    <!-- Table -->
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Position</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" style="text-align:center;padding:24px;color:#6b7280">Loading...</td>
          </tr>
          <tr v-else-if="employees.length === 0">
            <td colspan="6" style="text-align:center;padding:24px;color:#6b7280">No employees found.</td>
          </tr>
          <tr v-for="emp in employees" :key="emp.id">
            <td>
              <div style="font-weight:500">{{ emp.ime }} {{ emp.prezime }}</div>
              <div v-if="isAdmin(emp)" style="font-size:11px;color:#6b7280">Admin</div>
            </td>
            <td>{{ emp.email }}</td>
            <td>{{ emp.pozicija || '—' }}</td>
            <td>{{ emp.brojTelefona || '—' }}</td>
            <td>
              <span :class="emp.aktivan ? 'badge badge-green' : 'badge badge-red'">
                {{ emp.aktivan ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td>
              <div class="table-actions">
                <!-- Edit: only for non-admin employees -->
                <button
                  v-if="perms.canUpdate() && !isAdmin(emp)"
                  class="btn-primary btn-sm"
                  @click="openEdit(emp)"
                >Edit</button>

                <!-- Activate/Deactivate -->
                <button
                  v-if="canToggleActive(emp)"
                  :class="emp.aktivan ? 'btn-danger btn-sm' : 'btn-success btn-sm'"
                  @click="toggleActive(emp)"
                >{{ emp.aktivan ? 'Deactivate' : 'Activate' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="total > pageSize" class="pagination">
      <button class="btn-secondary btn-sm" :disabled="page <= 1" @click="page--; fetchEmployees()">←</button>
      <span>Page {{ page }} of {{ totalPages() }} ({{ total }} total)</span>
      <button class="btn-secondary btn-sm" :disabled="page >= totalPages()" @click="page++; fetchEmployees()">→</button>
    </div>
  </div>

  <!-- Create dialog -->
  <CreateEmployeeDialog
    v-if="showCreate"
    @close="showCreate = false"
    @created="onCreated"
  />

  <!-- Edit dialog -->
  <EditEmployeeDialog
    v-if="editingEmployee"
    :employee="editingEmployee"
    :allPermissions="allPermissions"
    @close="editingEmployee = null"
    @saved="onSaved"
  />
</template>
