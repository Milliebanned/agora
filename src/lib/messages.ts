// What the app says back when something works. One file so the same event
// reads the same way everywhere, and so the voice stays plain: say what
// happened, then who is waiting on what next.
//
// Escrow results are not here on purpose — the fund, approve and claim routes
// return messages naming the actual amount ("300.00 NIM confirmed in escrow"),
// which beats anything that can be written ahead of time. The panels pass those
// straight through.
export const MESSAGES = {
  applicationSent: 'Application submitted. The client sees it on their board.',
  applicationUpdated: 'Application updated.',
  proposalDeclined: 'Proposal declined.',

  workSubmitted: 'Work submitted for review. The client checks it against the deliverables.',
  workApproved: 'Work approved. The escrow is released for the freelancer to claim.',

  disputeOpened: 'Dispute opened. Run the mediator from the dispute page.',

  advertisementPublished: 'Advertisement published. Clients can find you under Find workers.',
  advertisementPaused: 'Advertisement taken off the board. You can put it back any time.',
  advertisementRemoved: 'Advertisement deleted.',

  profileSaved: 'Profile saved.',
  roleSwitched: (label: string) =>
    `You're now set up as a ${label.toLowerCase()}. Your dashboard has been updated.`,
} as const

// What it says when something fails and we have nothing more specific. Every
// caller should prefer the server's own message when there is one.
export const FALLBACK_ERROR = 'Something went wrong. Nothing was changed — try again.'
