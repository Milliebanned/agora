// Which chain this deployment is on. One answer, in one place.
//
// This module exists because there were two answers. The RPC client chose its
// endpoint from NIMIQ_NETWORK; the escrow wallet chose its signing network id
// from NEXT_PUBLIC_NIMIQ_NETWORK. Setting one and not the other left the server
// verifying payments against one chain while the wallet transacted on another,
// and the symptom was not an error — it was a payment that had genuinely
// happened being reported as never seen, forever, because it was being looked
// for on the wrong chain.
//
// Both variables are still read, so an existing deployment keeps working, but
// they must agree, and on a money path there is no silent default: a server
// that cannot say which chain it is on refuses to guess.

export class NetworkConfigError extends Error {}

export type NimiqNetwork = 'mainnet' | 'testnet'

// Confirmed against @nimiq/core: signing with 24 reports "mainalbatross",
// 5 reports "testalbatross".
export const NETWORK_IDS: Record<NimiqNetwork, number> = {
  mainnet: 24,
  testnet: 5,
}

function normalise(value: string | undefined): NimiqNetwork | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === 'mainnet' || v === 'main' || v === 'mainalbatross') return 'mainnet'
  if (v === 'testnet' || v === 'test' || v === 'testalbatross') return 'testnet'
  return null
}

// The network, or a refusal to guess.
//
// Disagreement between the two variables throws rather than picking a winner.
// Picking a winner is what produced payments that could never be found.
export function resolveNetwork(): NimiqNetwork {
  const server = process.env.NIMIQ_NETWORK
  const shared = process.env.NEXT_PUBLIC_NIMIQ_NETWORK

  const a = normalise(server)
  const b = normalise(shared)

  if (server && !a) {
    throw new NetworkConfigError(`NIMIQ_NETWORK is "${server}" — expected "mainnet" or "testnet".`)
  }
  if (shared && !b) {
    throw new NetworkConfigError(
      `NEXT_PUBLIC_NIMIQ_NETWORK is "${shared}" — expected "mainnet" or "testnet".`,
    )
  }

  if (a && b && a !== b) {
    throw new NetworkConfigError(
      `Network configuration disagrees with itself: NIMIQ_NETWORK is "${a}" but ` +
        `NEXT_PUBLIC_NIMIQ_NETWORK is "${b}". The server would verify payments on one chain ` +
        `while the wallet transacts on the other. Set both to the same value.`,
    )
  }

  const network = a ?? b
  if (!network) {
    throw new NetworkConfigError(
      'No Nimiq network is configured. Set NIMIQ_NETWORK (and NEXT_PUBLIC_NIMIQ_NETWORK) to ' +
        '"mainnet" or "testnet". This is deliberately not defaulted: guessing wrong means ' +
        'looking for real payments on the wrong chain.',
    )
  }
  return network
}

export function networkId(): number {
  const explicit = process.env.NIMIQ_NETWORK_ID
  if (explicit) {
    const parsed = Number(explicit)
    if (!Number.isInteger(parsed)) {
      throw new NetworkConfigError(`NIMIQ_NETWORK_ID must be an integer, got "${explicit}"`)
    }
    return parsed
  }
  return NETWORK_IDS[resolveNetwork()]
}

// The RPC endpoint for the resolved network. Named per network so a mainnet
// deployment cannot quietly fall back to a testnet node.
export function rpcEndpoint(): string {
  const network = resolveNetwork()
  const url =
    network === 'mainnet'
      ? process.env.NIMIQ_MAINNET_RPC_ENDPOINT
      : process.env.NIMIQ_RPC_ENDPOINT

  if (!url) {
    throw new NetworkConfigError(
      network === 'mainnet'
        ? 'NIMIQ_MAINNET_RPC_ENDPOINT is not set, but the network is mainnet.'
        : 'NIMIQ_RPC_ENDPOINT is not set, but the network is testnet.',
    )
  }
  return url
}
