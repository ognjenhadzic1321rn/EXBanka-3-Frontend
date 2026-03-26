import {
  adminLogin,
  fetchCurrencies,
  createClient,
  activateClient,
  loginClientUi,
  createAccount,
  fetchOtp,
} from './helpers/banking'

describe('Cross-currency transfer', () => {
  it('creates a transfer between RSD and EUR accounts with exchange rate and commission', () => {
    const testData = {
      client: null,
      rsdAccount: null,
      eurAccount: null,
      purpose: `cypress-xfer-cross-${Date.now()}`,
    }

    adminLogin()
      .then((employeeToken) =>
        fetchCurrencies(employeeToken).then((currencies) => {
          const rsd = currencies.find((c) => c.kod === 'RSD')
          const eur = currencies.find((c) => c.kod === 'EUR')
          expect(rsd, 'RSD').to.exist
          expect(eur, 'EUR').to.exist
          return { employeeToken, rsd, eur }
        })
      )
      .then(({ employeeToken, rsd, eur }) =>
        createClient(employeeToken, 'xfer-cross').then((client) => ({
          employeeToken,
          rsd,
          eur,
          client,
        }))
      )
      .then(({ employeeToken, rsd, eur, client }) => {
        testData.client = client
        activateClient(client.setupToken)
        return createAccount(employeeToken, client.id, rsd.id, `RSD ${Date.now()}`, 50000).then(
          (rsdAcc) => {
            testData.rsdAccount = rsdAcc
            return cy.request({
              method: 'POST',
              url: '/api/v1/accounts/create',
              headers: { Authorization: `Bearer ${employeeToken}` },
              body: {
                clientId: Number(client.id),
                currencyId: eur.id,
                tip: 'devizni',
                vrsta: 'licni',
                podvrsta: '',
                naziv: `EUR ${Date.now()}`,
                pocetnoStanje: 100,
              },
            }).its('body.account').then((eurAcc) => {
              testData.eurAccount = eurAcc
            })
          }
        )
      })
      .then(() => {
        loginClientUi(testData.client.email)
        cy.visit('/client/transfers')
        cy.contains('h1', 'Transferi').should('be.visible')

        // Select from RSD
        cy.get('.tf-card-primary .tf-field select')
          .eq(0)
          .select(String(testData.rsdAccount.id))

        // Select to EUR
        cy.get('.tf-card-primary .tf-field select')
          .eq(1)
          .select(String(testData.eurAccount.id))

        cy.get('input[type="number"]').clear().type('1000')
        cy.get('input[placeholder="Svrha transakcije"]').clear().type(testData.purpose)
        cy.contains('button', 'Nastavi').click()

        // Confirm: should show kurs and provizija for cross-currency
        cy.contains('span', 'Provizija').should('be.visible')
        cy.contains('span', 'Kurs').should('be.visible')
        cy.contains('button', 'Potvrdi transfer').click()

        // OTP
        fetchOtp(testData.client.email, testData.purpose).then((otp) => {
          cy.get('input[maxlength="6"]').clear().type(otp)
          cy.contains('button', 'Verifikuj transfer').click()
        })

        cy.contains('Transfer uspesno realizovan!').should('be.visible')
      })
  })
})
