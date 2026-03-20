import { useAuthStore } from '../stores/auth'

// Employee role hierarchy: Admin > Supervisor > Agent > Basic
const ROLE_LEVELS: Record<string, number> = {
  employeeAdmin: 4,
  employeeSupervisor: 3,
  employeeAgent: 2,
  employeeBasic: 1,
}

function hasRole(permissions: string[], requiredRole: string): boolean {
  const requiredLevel = ROLE_LEVELS[requiredRole] ?? 0
  return permissions.some(p => (ROLE_LEVELS[p] ?? 0) >= requiredLevel)
}

export function usePermissions() {
  const auth = useAuthStore()
  const perms = () => auth.permissions

  return {
    // Role checks (hierarchical)
    isBasic:      () => hasRole(perms(), 'employeeBasic'),
    isAgent:      () => hasRole(perms(), 'employeeAgent'),
    isSupervisor: () => hasRole(perms(), 'employeeSupervisor'),
    isAdmin:      () => hasRole(perms(), 'employeeAdmin'),

    // Functional checks based on role hierarchy
    canManageClients:  () => hasRole(perms(), 'employeeBasic'),
    canBankOperations: () => hasRole(perms(), 'employeeBasic'),
    canStockTrading:   () => hasRole(perms(), 'employeeAgent'),
    canManageAll:      () => hasRole(perms(), 'employeeAdmin'),

    // Legacy compat
    canCreate:            () => hasRole(perms(), 'employeeAdmin'),
    canRead:              () => hasRole(perms(), 'employeeAdmin'),
    canUpdate:            () => hasRole(perms(), 'employeeAdmin'),
    canActivate:          () => hasRole(perms(), 'employeeAdmin'),
    canManagePermissions: () => hasRole(perms(), 'employeeAdmin'),
  }
}
