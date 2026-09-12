import prisma from './db'

// Telling someone something happened to them.
//
// Written per recipient at the moment of the event rather than derived later,
// because the thing worth knowing — has this person seen it yet — exists
// nowhere else. Everything here is best-effort: a notification that fails to
// write must never take down the action that caused it. Nobody's escrow should
// fail to settle because a badge could not be incremented.

export const TABS = {
  deals: '/dashboard/agreements',
  disputes: '/dashboard/disputes',
  applications: '/dashboard/applications',
  ads: '/dashboard/advertisements',
} as const

export type NotificationTab = (typeof TABS)[keyof typeof TABS]

interface NotifyInput {
  userId: string | null | undefined
  tab: NotificationTab
  type: string
  /** One sentence, already written for the person who will read it. */
  body: string
  href?: string
  agreementId?: string
}

export async function notify(input: NotifyInput): Promise<void> {
  if (!input.userId) return
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        tab: input.tab,
        type: input.type,
        body: input.body.slice(0, 300),
        href: input.href,
        agreementId: input.agreementId,
      },
    })
  } catch (err) {
    console.error('[notify] could not record a notification:', err)
  }
}

// Several people about the same thing, each with their own copy to mark read.
export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map(notify))
}
