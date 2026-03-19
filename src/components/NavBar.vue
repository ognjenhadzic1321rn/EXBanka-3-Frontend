<script setup lang="ts">
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePermissions } from '../composables/usePermissions'

const router = useRouter()
const auth = useAuthStore()
const perms = usePermissions()

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav class="navbar">
    <div style="display:flex;align-items:center;gap:24px">
      <span class="navbar-brand">EXBanka</span>
      <RouterLink
        v-if="perms.canRead()"
        to="/employees"
        style="color:#93c5fd;font-size:14px;text-decoration:none"
        active-class="navbar-nav-active"
      >Employees</RouterLink>
      <RouterLink
        to="/clients"
        style="color:#93c5fd;font-size:14px;text-decoration:none"
        active-class="navbar-nav-active"
      >Clients</RouterLink>
      <RouterLink
        to="/accounts"
        style="color:#93c5fd;font-size:14px;text-decoration:none"
        active-class="navbar-nav-active"
      >Accounts</RouterLink>
    </div>
    <div class="navbar-right">
      <span class="navbar-user">
        {{ auth.employee?.ime }} {{ auth.employee?.prezime }}
      </span>
      <button class="navbar-logout" @click="logout">Sign Out</button>
    </div>
  </nav>
</template>
