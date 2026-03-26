describe('Employee login', () => {
  it('logs in as admin employee and sees the portal', () => {
    cy.visit('/login')
    cy.get('input[type="email"]').clear().type(Cypress.env('adminEmail'))
    cy.get('input[type="password"]').clear().type(Cypress.env('adminPassword'))
    cy.contains('button', 'Sign In').click()

    cy.url().should('not.include', '/login')
    cy.contains('Klijenti').should('be.visible')
    cy.contains('Računi').should('be.visible')
  })
})
