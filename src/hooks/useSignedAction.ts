'use client'

import { useCallback, useState } from 'react'
import { signMessage } from '@/lib/nimiq'

export type SignedAction =
  | 'claim_escrow'
  | 'approve_work'
  | 'accept_proposal'
  | 'withdraw_posting'
  | 'settle_dispute'
  | 'submit_proposal'
  | 'submit_work'
  | 'post_job'
  | 'publish_ad'
  | 'open_dispute'

export interface ActionProof {
  nonce: string
  signature: string
  publicKey: string
}

/**
 * Ask the wallet to authorise one action.
 *
 * Three steps that always go together, so they live in one place: ask the
 * server for a sentence to sign, put it in front of the wallet, hand back the
 * proof for the request that follows. The sentence is written by the server
 * and names the deal and the amount, so what Nimiq Pay displays is what the
 * server will act on.
 *
 * Returns null when the person declines, which is not an error: changing your
 * mind in the wallet dialog is a legitimate answer and the caller should just
 * stop, quietly.
 */
export function useSignedAction() {
  const [signing, setSigning] = useState(false)

  const sign = useCallback(
    async (action: SignedAction, subjectId?: string): Promise<ActionProof | null> => {
      setSigning(true)
      try {
        const res = await fetch('/api/actions/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, subjectId }),
        })
        if (!res.ok) throw new Error('Could not prepare the signing request.')
        const { nonce, message } = await res.json()

        const signed = await signMessage(message)
        if (!signed?.signature) return null

        return { nonce, signature: signed.signature, publicKey: signed.publicKey }
      } finally {
        setSigning(false)
      }
    },
    [],
  )

  return { sign, signing }
}
