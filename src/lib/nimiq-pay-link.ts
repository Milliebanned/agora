// Handing somebody off to the Nimiq Pay app.
//
// Agora is a Mini App: the wallet only exists inside Nimiq Pay, and a browser
// tab has no provider to talk to. Rather than telling somebody who already has
// the app to go and find it themselves, the link below asks the phone to open
// it on this site.
//
// nimpay.app publishes both an Apple app-site-association and an Android
// assetlinks.json claiming every path on the domain for com.nimiq.pay, so on a
// phone with the app installed the operating system intercepts this URL and
// opens the app directly. The web server behind it is not a fallback: it
// answers 404, which is why the code below only ever tries this once and shows
// our own instructions afterwards.

/** The documented https form. Preferred over the nimiqpay:// scheme because an
 *  unhandled custom scheme raises a browser error dialog, while an unhandled
 *  universal link merely fails to be intercepted. */
export function nimiqPayLinkFor(host: string): string {
  return `https://nimpay.app/miniapps/open/${host}`
}

/** Phones only. A universal link cannot open a phone app from a desktop, and
 *  sending a desktop visitor to a 404 would be worse than telling them plainly
 *  that they need the app. */
export function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

const TRIED_KEY = 'agora.triedNimiqPayHandoff'

/** Remembered for the tab, not the device: somebody who comes back from a dead
 *  end should see the instructions rather than be bounced straight out again,
 *  but installing the app and returning later should still hand off. */
function alreadyTried(): boolean {
  try {
    return sessionStorage.getItem(TRIED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberTried(): void {
  try {
    sessionStorage.setItem(TRIED_KEY, '1')
  } catch {
    // Private mode. One extra hand-off attempt is a small price.
  }
}

/**
 * Try to reopen this site inside Nimiq Pay.
 *
 * Returns true when the hand-off was attempted, in which case the page is on
 * its way out and the caller should stop. Returns false when it was not
 * attempted, and the caller should show the "you need the app" instructions.
 */
export function insideNimiqPay(): boolean {
  if (typeof window === 'undefined') return false
  // The development wallet stands in for the host, so treat it as one. Without
  // this, local dev would be handed off to the app instead of signing in.
  if (process.env.NEXT_PUBLIC_MOCK_WALLET === 'true') return true
  const host = window as unknown as { nimiq?: unknown; nimiqPay?: unknown }
  // Either is proof: the provider itself, or the host context object Nimiq Pay
  // exposes alongside it. Both are injected while the page loads, long before
  // anybody can reach for a button, so checking at click time is reliable.
  return Boolean(host.nimiq ?? host.nimiqPay)
}

export function openInNimiqPay(): boolean {
  if (typeof window === 'undefined') return false
  if (!isPhone()) return false
  // Never bounce somebody who is already in the app: that would be a loop.
  if (insideNimiqPay()) return false
  if (alreadyTried()) return false

  rememberTried()
  window.location.href = nimiqPayLinkFor(window.location.host)
  return true
}

/**
 * Wait briefly for the provider, then answer whether we are inside the app.
 *
 * The SDK waits ten seconds before conceding there is no wallet, which is the
 * right patience for a host that is still starting up and the wrong answer for
 * a browser that will never have one. A short grace period covers a late
 * injection without making somebody in the wrong browser watch a spinner.
 */
export async function detectNimiqPay(graceMs = 1200): Promise<boolean> {
  if (insideNimiqPay()) return true
  const until = Date.now() + graceMs
  while (Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 60))
    if (insideNimiqPay()) return true
  }
  return false
}
