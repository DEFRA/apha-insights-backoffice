// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://insights.service.gov.uk/" }
import cookies from '#/client/javascripts/cookies.js'

const CRUMB = 'test-crumb'
const GTM_KEY = 'GTM-ABC123'
const GTM_SCRIPT_SELECTOR = 'script[src*="googletagmanager.com/gtm.js"]'

const bannerHtml = ({ gtmKey = GTM_KEY } = {}) => `
  <form method="post" action="/cookies">
    <div class="js-cookies-container js-cookies-banner" data-crumb="${CRUMB}" data-gtm-key="${gtmKey}">
      <div class="js-question-banner">
        <button class="js-cookies-button-accept">Accept analytics cookies</button>
        <button class="js-cookies-button-reject">Reject analytics cookies</button>
      </div>
      <div class="js-cookies-accepted" hidden><button type="button" class="js-hide">Hide</button></div>
      <div class="js-cookies-rejected" hidden><button type="button" class="js-hide">Hide</button></div>
    </div>
  </form>`

class FakeXhr {
  static instances = []

  constructor() {
    this.headers = {}
    FakeXhr.instances.push(this)
  }

  open(method, url, isAsync) {
    Object.assign(this, { method, url, isAsync })
  }

  setRequestHeader(name, value) {
    this.headers[name] = value
  }

  send(body) {
    this.body = JSON.parse(body)
  }

  respond(status) {
    this.status = status
    this.onload()
  }
}

const setCookies = (...cookieNames) => {
  for (const name of cookieNames) {
    document.cookie = `${name}=value;path=/`
  }
}

const cookieNames = () =>
  document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

const clearCookies = () => {
  for (const name of cookieNames()) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  }
}

const click = (selector) => document.querySelector(selector).click()

const lastRequest = () => FakeXhr.instances.at(-1)

describe('cookies', () => {
  let submitForm

  beforeEach(() => {
    FakeXhr.instances = []
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    submitForm = vi
      .spyOn(globalThis.HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {})
    clearCookies()
    delete globalThis.dataLayer
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('when the cookie banner is not on the page', () => {
    test('does not send anything or throw', () => {
      expect(() => cookies.init()).not.toThrow()
      expect(FakeXhr.instances).toHaveLength(0)
    })

    test('deletes stale Google Analytics cookies when Google Tag Manager is not loaded', () => {
      setCookies('_ga', '_gid', 'session')

      cookies.init()

      expect(cookieNames()).toEqual(['session'])
    })

    test('keeps Google Analytics cookies when Google Tag Manager is loaded', () => {
      document.head.innerHTML = `<script src="https://www.googletagmanager.com/gtm.js?id=${GTM_KEY}"></script>`
      setCookies('_ga', 'session')

      cookies.init()

      expect(cookieNames()).toEqual(['_ga', 'session'])
    })
  })

  describe('when the cookie banner is on the page', () => {
    test('does not delete Google Analytics cookies before the user chooses', () => {
      document.body.innerHTML = bannerHtml()
      setCookies('_ga')

      cookies.init()

      expect(cookieNames()).toEqual(['_ga'])
    })

    describe('accepting analytics cookies', () => {
      beforeEach(() => {
        document.body.innerHTML = bannerHtml()
        cookies.init()
      })

      test('sends the choice and the crumb to the server as JSON', () => {
        click('.js-cookies-button-accept')

        expect(lastRequest()).toMatchObject({
          method: 'POST',
          url: '/cookies',
          isAsync: true,
          headers: { 'Content-Type': 'application/json' },
          body: { analytics: true, async: true, crumb: CRUMB }
        })
      })

      test('replaces the question with the accepted message and focuses it', () => {
        click('.js-cookies-button-accept')

        const accepted = document.querySelector('.js-cookies-accepted')
        expect(document.querySelector('.js-question-banner').hidden).toBe(true)
        expect(accepted.hidden).toBe(false)
        expect(accepted.getAttribute('tabindex')).toBe('-1')
        expect(document.activeElement).toBe(accepted)
      })

      test('removes the temporary tabindex when the message loses focus', () => {
        click('.js-cookies-button-accept')

        const accepted = document.querySelector('.js-cookies-accepted')
        accepted.dispatchEvent(new Event('blur'))

        expect(accepted.hasAttribute('tabindex')).toBe(false)
      })

      test('loads Google Tag Manager straight away', () => {
        click('.js-cookies-button-accept')

        expect(document.querySelector(GTM_SCRIPT_SELECTOR).src).toBe(
          `https://www.googletagmanager.com/gtm.js?id=${GTM_KEY}`
        )
        expect(globalThis.dataLayer).toEqual([
          expect.objectContaining({ event: 'gtm.js' })
        ])
      })

      test('does not submit the form when the server accepts the choice', () => {
        click('.js-cookies-button-accept')
        lastRequest().respond(200)

        expect(submitForm).not.toHaveBeenCalled()
      })

      test('submits the form instead when the server rejects the request', () => {
        click('.js-cookies-button-accept')
        lastRequest().respond(403)

        expect(submitForm).toHaveBeenCalledOnce()
      })

      test('submits the form instead when the request fails', () => {
        click('.js-cookies-button-accept')
        lastRequest().onerror()

        expect(submitForm).toHaveBeenCalledOnce()
      })

      test('hides the banner when the user hides the message', () => {
        click('.js-cookies-button-accept')
        click('.js-cookies-accepted .js-hide')

        expect(document.querySelector('.js-cookies-banner').hidden).toBe(true)
      })
    })

    test('does not load Google Tag Manager when the container ID is not valid', () => {
      document.body.innerHTML = bannerHtml({ gtmKey: 'UA-12345' })
      cookies.init()

      click('.js-cookies-button-accept')

      expect(document.querySelector(GTM_SCRIPT_SELECTOR)).toBeNull()
      expect(globalThis.dataLayer).toBeUndefined()
    })

    describe('rejecting analytics cookies', () => {
      beforeEach(() => {
        document.body.innerHTML = bannerHtml()
        cookies.init()
      })

      test('sends the choice and the crumb to the server', () => {
        click('.js-cookies-button-reject')

        expect(lastRequest().body).toEqual({
          analytics: false,
          async: true,
          crumb: CRUMB
        })
      })

      test('deletes every Google Analytics cookie and keeps the rest', () => {
        setCookies(
          '_ga',
          '_ga_ABC123',
          '_gid',
          '_gat',
          '_dc_gtm_UA1',
          'session'
        )

        click('.js-cookies-button-reject')

        expect(cookieNames()).toEqual(['session'])
      })

      test('replaces the question with the rejected message', () => {
        click('.js-cookies-button-reject')

        expect(document.querySelector('.js-question-banner').hidden).toBe(true)
        expect(document.querySelector('.js-cookies-rejected').hidden).toBe(
          false
        )
      })

      test('hides the banner when the user hides the message', () => {
        click('.js-cookies-button-reject')
        click('.js-cookies-rejected .js-hide')

        expect(document.querySelector('.js-cookies-banner').hidden).toBe(true)
      })
    })
  })

  describe('when the browser restores the page from the back/forward cache', () => {
    const pageshow = (persisted) => {
      const event = new Event('pageshow')
      Object.defineProperty(event, 'persisted', { value: persisted })
      globalThis.dispatchEvent(event)
    }

    test('deletes Google Analytics cookies and reloads the page', () => {
      // jsdom cannot navigate, so it reports the reload attempt on its virtual console
      const jsdomErrors = []
      const recordError = (error) => jsdomErrors.push(error.message)
      globalThis.jsdom.virtualConsole.on('jsdomError', recordError)
      document.body.innerHTML = bannerHtml()
      cookies.init()
      setCookies('_ga', 'session')

      pageshow(true)
      globalThis.jsdom.virtualConsole.off('jsdomError', recordError)

      expect(cookieNames()).toEqual(['session'])
      expect(jsdomErrors).toContainEqual(expect.stringContaining('navigation'))
    })

    test('does nothing on a normal page load', () => {
      document.body.innerHTML = bannerHtml()
      cookies.init()
      setCookies('_ga')

      pageshow(false)

      expect(cookieNames()).toEqual(['_ga'])
    })
  })
})
