import {
  adminLogin,
  createClient,
  activateClient,
  loginClientUi,
} from '../helpers/banking'

describe('Payment recipients', () => {
  it('creates, edits, and deletes a saved recipient', () => {
    const testData = {
      client: null,
      initialName: `Primaoc ${Date.now()}`,
      updatedName: `Primaoc izmenjen ${Date.now()}`,
      accountNumber: '333000140744023911',
    }

    adminLogin()
      .then((employeeToken) => createClient(employeeToken, 'recipients'))
      .then((client) => {
        testData.client = client
        activateClient(client.setupToken)
      })
      .then(() => {
        loginClientUi(testData.client.email)

        cy.visit('/client/recipients')
        cy.contains('h1', 'Primaoci').should('be.visible')

        cy.contains('button', 'Dodaj primaoca').click()
        cy.get('.rcp-modal input').eq(0).clear().type(testData.initialName)
        cy.get('.rcp-modal input').eq(1).clear().type(testData.accountNumber)
        cy.contains('.rcp-modal button', 'Potvrdi').click()

        cy.contains(testData.initialName).should('be.visible')
        cy.contains(testData.accountNumber).should('be.visible')

        cy.contains('.rcp-card', testData.initialName).within(() => {
          cy.contains('button', 'Izmeni').click()
        })
        cy.get('.rcp-modal input').eq(0).clear().type(testData.updatedName)
        cy.contains('.rcp-modal button', 'Potvrdi').click()

        cy.contains(testData.updatedName).should('be.visible')
        cy.contains(testData.initialName).should('not.exist')

        cy.contains('.rcp-card', testData.updatedName).within(() => {
          cy.contains('button', 'Obriši').click()
        })
        cy.contains('.rcp-modal button', 'Obriši').click()

        cy.contains(testData.updatedName).should('not.exist')
      })
  })
})
