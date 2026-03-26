import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
  fetchOtp,
} from '../helpers/banking'

describe('New payment flow', () => {
  it('creates a payment, verifies it, adds a recipient, and shows it in overview', () => {
    const testData = {
      sender: null,
      receiver: null,
      senderAccount: null,
      receiverAccount: null,
      purpose: `cypress-payment-${Date.now()}`,
    }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((item) => item.kod === 'RSD')
          expect(rsd, 'RSD currency').to.exist
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'payment-sender').then((sender) =>
          createClient(employeeToken, 'payment-receiver').then((receiver) => ({
            employeeToken,
            rsd,
            sender,
            receiver,
          }))
        )
      )
      .then(({ employeeToken, rsd, sender, receiver }) => {
        testData.sender = sender
        testData.receiver = receiver
        activateClient(sender.setupToken)
        activateClient(receiver.setupToken)

        return createAccount(employeeToken, sender.id, rsd.id, `Plaćanje pošiljalac ${Date.now()}`, 5000).then((senderAccount) => {
          testData.senderAccount = senderAccount
          return createAccount(employeeToken, receiver.id, rsd.id, `Plaćanje primalac ${Date.now()}`, 100).then((receiverAccount) => {
            testData.receiverAccount = receiverAccount
          })
        })
      })
      .then(() => {
        loginClientUi(testData.sender.email)

        cy.visit('/client/payments/new')
        cy.contains('h1', 'Novo plaćanje').should('be.visible')

        cy.get('.pay-toggle button').eq(1).click().should('have.class', 'active')
        cy.get('input[placeholder="Naziv primaoca"]').clear().type('Cypress Primaoc')
        cy.get('input[placeholder*="Broj računa primaoca"]').clear().type(testData.receiverAccount.brojRacuna)
        cy.get('input[type="number"]').first().clear().type('250')
        cy.get('input[placeholder="Poziv na broj"]').clear().type('CY-PAY-1')
        cy.get('input[placeholder="Svrha plaćanja"]').clear().type(testData.purpose)
        cy.get('.pay-field select').last().select(String(testData.senderAccount.id))

        cy.contains('button', 'Nastavi').click()
        cy.contains('Pregled naloga').should('be.visible')
        cy.contains(testData.receiverAccount.brojRacuna).should('be.visible')
        cy.contains('button', 'Potvrdi').click()

        fetchOtp(testData.sender.email, testData.purpose).then((otp) => {
          cy.get('.pay-code-input').clear().type(otp)
          cy.contains('button', 'Potvrdi kod').click()
        })

        cy.contains('Plaćanje uspešno!').should('be.visible')
        cy.contains('button', '+ Dodaj primaoca').click()
        cy.contains('Primalac dodat u listu primalaca plaćanja.').should('be.visible')
        cy.contains('button', 'Pregled plaćanja').click()

        cy.url().should('include', '/client/payments')
        cy.contains('h1', 'Plaćanja').should('be.visible')
        cy.get('.pv-filters select').first().select('uspesno')
        cy.get('.pv-filters input[type="number"]').first().clear().type('200').blur()
        cy.contains('.payment-row', testData.purpose).should('be.visible')
        cy.contains('.payment-row', testData.purpose).click()
        cy.contains('Detalji plaćanja').should('be.visible')
        cy.contains('button', 'Štampaj potvrdu').should('be.visible')
      })
  })
})
