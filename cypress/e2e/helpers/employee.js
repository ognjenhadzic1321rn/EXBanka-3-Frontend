const API_BASE = '/api/v1'

export function adminLogin() {
  return cy
    .request('POST', `${API_BASE}/auth/login`, {
      email: Cypress.env('adminEmail'),
      password: Cypress.env('adminPassword'),
    })
    .its('body')
}

export function loginEmployeeUi(email = Cypress.env('adminEmail'), password = Cypress.env('adminPassword')) {
  cy.visit('/login')
  cy.get('input[type="email"]').clear().type(email)
  cy.get('input[type="password"]').clear().type(password)
  cy.contains('button', 'Sign In').click()
  cy.url().should('not.include', '/login')
}

export { API_BASE }
