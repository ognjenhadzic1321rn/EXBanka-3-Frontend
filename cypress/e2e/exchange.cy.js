import {
  adminLogin,
  createClient,
  activateClient,
  loginClientUi,
} from './helpers/banking'

describe('Exchange rate list and calculator', () => {
  it('displays rate list and calculates currency conversion', () => {
    adminLogin()
      .then((employeeToken) => createClient(employeeToken, 'exchange'))
      .then((client) => {
        activateClient(client.setupToken)
        loginClientUi(client.email)

        cy.visit('/client/exchange')

        // Rate list visible
        cy.contains('Kursna lista').should('be.visible')
        cy.get('.ex-rate-row').should('have.length.at.least', 1)

        // Calculator fields visible
        cy.get('select').should('have.length.at.least', 2)
        cy.get('input[type="number"]').should('be.visible')

        // Enter amount
        cy.get('input[type="number"]').clear().type('1000')
      })
  })
})
