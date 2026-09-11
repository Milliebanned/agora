'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Plus, X, Eye, EyeOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader, EmptyState, PageLoading, Spinner } from '@/components/ui/page'
import { useToast } from '@/components/ui/toast'
import { useSession } from '@/components/SessionProvider'
import { CATEGORIES, categoryLabel } from '@/lib/opportunities'
import { MESSAGES, FALLBACK_ERROR } from '@/lib/messages'
import { cn } from '@/lib/utils'

interface Listing {
  id: string
  title: string
  description: string
  category: string
  serviceType: string | null
  priceNIM: string | number
  deliveryDays: number
  status: string
  createdAt: string
}

const CUSTOM = '__custom__'

// Where a freelancer says what they do and what they charge for it. This is an
// advertisement, not a deal: no escrow is involved until a client hires from it
// and commits a budget the normal way.
export default function AdvertisementsPage() {
  const router = useRouter()
  const toast = useToast()
  const { role, loading: sessionLoading } = useSession()

  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [servicePick, setServicePick] = useState(CATEGORIES[0].services[0])
  const [customService, setCustomService] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [deliveryDays, setDeliveryDays] = useState('')

  const services = useMemo(
    () => CATEGORIES.find((c) => c.id === category)?.services ?? [],
    [category],
  )
  const serviceType = servicePick === CUSTOM ? customService.trim() : servicePick

  // Advertising is the freelancer side. A client who lands here is sent to the
  // board where they browse these instead.
  useEffect(() => {
    if (sessionLoading) return
    if (role && role !== 'provider') router.replace('/dashboard/workers')
  }, [role, sessionLoading, router])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/services?scope=mine', { credentials: 'include' })
      if (res.ok) setListings(await res.json())
    } catch (err) {
      console.error('Failed to load advertisements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionLoading || role !== 'provider') return
    load()
  }, [load, role, sessionLoading])

  const reset = () => {
    setTitle('')
    setDescription('')
    setPrice('')
    setDeliveryDays('')
    setCategory(CATEGORIES[0].id)
    setServicePick(CATEGORIES[0].services[0])
    setCustomService('')
  }

  const publish = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('create')
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description,
          category,
          serviceType,
          priceNIM: Number(price),
          deliveryDays: Number(deliveryDays),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error ?? FALLBACK_ERROR)
        return
      }
      toast.success(MESSAGES.advertisementPublished)
      reset()
      setComposing(false)
      await load()
    } catch {
      toast.error(FALLBACK_ERROR)
    } finally {
      setBusy(null)
    }
  }

  const setStatus = async (listing: Listing, status: 'published' | 'paused') => {
    setBusy(listing.id)
    try {
      const res = await fetch(`/api/services/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        toast.error((await res.json().catch(() => null))?.error ?? FALLBACK_ERROR)
        return
      }
      toast.success(
        status === 'paused' ? MESSAGES.advertisementPaused : MESSAGES.advertisementPublished,
      )
      await load()
    } catch {
      toast.error(FALLBACK_ERROR)
    } finally {
      setBusy(null)
    }
  }

  const remove = async (listing: Listing) => {
    setBusy(listing.id)
    try {
      const res = await fetch(`/api/services/${listing.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        toast.error((await res.json().catch(() => null))?.error ?? FALLBACK_ERROR)
        return
      }
      toast.success(MESSAGES.advertisementRemoved)
      await load()
    } catch {
      toast.error(FALLBACK_ERROR)
    } finally {
      setBusy(null)
    }
  }

  if (sessionLoading || (loading && role === 'provider')) {
    return <PageLoading label="Loading your advertisements" />
  }

  const live = listings.filter((l) => l.status === 'published').length

  return (
    <>
      <PageHeader
        title="My advertisements"
        description={
          listings.length === 0
            ? 'Tell clients what you do and what you charge. They browse these under Find workers.'
            : `${listings.length} advertisement${listings.length === 1 ? '' : 's'}, ${live} live on the board.`
        }
        action={
          composing ? (
            <Button variant="secondary" onClick={() => setComposing(false)}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button onClick={() => setComposing(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New advertisement
            </Button>
          )
        }
      />

      {composing && (
        <Card className="mb-6">
          <form onSubmit={publish} className="space-y-5 p-6">
            <div>
              <label className="text-[13px] font-medium text-secondary-foreground">
                What do you do?
              </label>
              <p className="mt-0.5 text-[12px] text-subtle-foreground">
                Write it the way a client would search for it, like “I will design your logo”.
              </p>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="I will design your logo"
                className="mt-2"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[13px] font-medium text-secondary-foreground">Category</label>
                <Select
                  value={category}
                  onChange={(e) => {
                    const id = e.target.value
                    setCategory(id)
                    setServicePick(CATEGORIES.find((c) => c.id === id)?.services[0] ?? '')
                    setCustomService('')
                  }}
                  className="mt-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-[13px] font-medium text-secondary-foreground">Service</label>
                <Select
                  value={servicePick}
                  onChange={(e) => setServicePick(e.target.value)}
                  className="mt-2"
                >
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value={CUSTOM}>Something else…</option>
                </Select>
                {servicePick === CUSTOM && (
                  <Input
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    placeholder="Name the service"
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-medium text-secondary-foreground">
                What the client gets
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you deliver, how you work, what you need from them to start."
                rows={5}
                className="mt-2"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[13px] font-medium text-secondary-foreground">
                  What you charge
                </label>
                <p className="mt-0.5 text-[12px] text-subtle-foreground">In NIM</p>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="300"
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-secondary-foreground">
                  Delivery time
                </label>
                <p className="mt-0.5 text-[12px] text-subtle-foreground">In days</p>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={deliveryDays}
                  onChange={(e) => setDeliveryDays(e.target.value)}
                  placeholder="5"
                  className="mt-2"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={busy === 'create'}>
              {busy === 'create' ? <Spinner className="h-4 w-4" /> : null}
              {busy === 'create' ? 'Publishing' : 'Publish advertisement'}
            </Button>
          </form>
        </Card>
      )}

      {listings.length === 0 ? (
        !composing && (
          <EmptyState
            icon={Megaphone}
            title="You have not advertised anything yet"
            description="Post what you do and what you charge. Clients browse these under Find workers and can hire you straight from one."
            action={
              <Button onClick={() => setComposing(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Write your first advertisement
              </Button>
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const paused = listing.status === 'paused'
            return (
              <Card key={listing.id} className={cn(paused && 'opacity-60')}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={paused ? 'neutral' : 'accent'}>
                          {paused ? 'Paused' : 'Live'}
                        </Badge>
                        <span className="text-[12px] text-subtle-foreground">
                          {categoryLabel(listing.category)}
                          {listing.serviceType ? ` · ${listing.serviceType}` : ''}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] font-medium tracking-body">{listing.title}</p>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                        {listing.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[15px] tabular-nums text-foreground">
                        {Number(listing.priceNIM).toFixed(0)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-subtle-foreground">
                        NIM · {listing.deliveryDays}d
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === listing.id}
                      onClick={() => setStatus(listing, paused ? 'published' : 'paused')}
                    >
                      {paused ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {paused ? 'Put back on the board' : 'Take off the board'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === listing.id}
                      onClick={() => remove(listing)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
