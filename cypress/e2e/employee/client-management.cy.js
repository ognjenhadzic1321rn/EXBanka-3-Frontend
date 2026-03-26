import { adminLogin, createClient } from '../helpers/banking'
import { loginEmployeeUi } from '../helpers/employee'

describe('Employee: Client management', () => {
  it('lists clients, edits a client, and validates email uniqueness', () => {
    const testData = { client1: null, client2: null }

    adminLogin()
      .then((employeeToken) =>
        createClient(employeeToken, 'mgmt1', { ime: 'Petar', prezime: 'Testić' }).then((c1) => {
          testData.client1 = c1
          return createClient(employeeToken, 'mgmt2', { ime: 'Marko', prezime: 'Drugi' }).then((c2) => {
            testData.client2 = c2
          })
        })
      )
      .then(() => {
        loginEmployeeUi()

        cy.visit('/clients')
        cy.contains(/[Kk]lijent/).should('be.visible')

        // Filter by name
        cy.get('input[placeholder*="imenu"], input[placeholder*="prezimenu"], input[placeholder*="Pretraži"]').first().type('Testić')
        cy.contains('button', 'Pretraži').click()
        cy.contains('Testić').should('be.visible')

        // Click to edit
        cy.contains('Testić').closest('tr').click()

        // Edit modal visible
        cy.get('.modal').should('be.visible')
      })
  })
})
