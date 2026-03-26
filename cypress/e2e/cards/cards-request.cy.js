import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
  fetchOtp,
} from '../helpers/banking'

describe('Client card request with email verification', () => {
  it('requests a new card, verifies via email code, and sees new card in list', () => {
    const testData = { client: null, account: null }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          return { employeeToken, rsd }
        })
      )
      .then(({ employeeToken, rsd }) =>
        createClient(employeeToken, 'card-req').then((client) => ({
          employeeToken,
          rsd,
          client,
        }))
      )
      .then(({ employeeToken, rsd, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `Kartica račun ${Date.now()}`, 5000).then(
          (account) => {
            testData.account = account
          }
        )
      })
      .then(() => {
        loginClientUi(testData.client.email)
        cy.visit('/client/cards')

        cy.contains('h1', 'Moje kartice').should('be.visible')

        // Click request new card
        cy.contains('button', 'Zatraži novu karticu').click()

        // Fill form
        cy.get('.cv-modal-wide select').first().select(String(testData.account.id))
        cy.get('.cv-modal-wide select').eq(1).select('visa')

        // Submit request
        cy.contains('button', 'Pošalji zahtev').click()

        // Verification step — fetch OTP from Mailhog
        cy.contains('Verifikacija').should('be.visible')

        fetchOtp(testData.client.email, 'Potvrdite').then((otp) => {
          cy.get('.cv-code-input').clear().type(otp)
          cy.contains('button', 'Potvrdi kod').click()
        })

        // Success
        cy.contains('Kartica kreirana').should('be.visible')
        cy.contains('button', 'Zatvori').click()

        // New card visible in list
        cy.get('.cv-card').should('have.length.at.least', 1)
      })
  })
})
