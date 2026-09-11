'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader, Spinner } from '@/components/ui/page'
import { CATEGORIES, MAX_DELIVERABLES } from '@/lib/opportunities'

const CUSTOM = '__custom__'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-[13px] font-medium text-secondary-foreground">{label}</label>
      {hint && <p className="mt-0.5 text-[12px] text-subtle-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

export default function NewOpportunityPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [servicePick, setServicePick] = useState(CATEGORIES[0].services[0])
  const [customService, setCustomService] = useState('')
  const [description, setDescription] = useState('')
  const [deliverables, setDeliverables] = useState<string[]>([''])
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [attachments, setAttachments] = useState<{ label: string; url: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Arriving from "Hire" on a freelancer's advertisement. The advertised terms
  // become the starting point for the posting, and stay fully editable — they
  // are the freelancer's asking price, not an agreement yet. Nothing is
  // committed until the client funds the escrow, exactly as with any posting.
  const [hiring, setHiring] = useState<{ name: string } | null>(null)
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    if (!from) return
    fetch(`/api/services/${from}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((listing) => {
        if (!listing) return
        setTitle(listing.title)
        setCategory(listing.category)
        setServicePick(listing.serviceType ?? CATEGORIES[0].services[0])
        setDescription(listing.description)
        setBudget(String(Number(listing.priceNIM)))
        setTimeline(String(listing.deliveryDays))
        setHiring({
          name: listing.provider?.displayName ?? 'this freelancer',
        })
      })
      .catch(() => {})
  }, [])

  const services = useMemo(
    () => CATEGORIES.find((c) => c.id === category)?.services ?? [],
    [category],
  )

  const pickCategory = (id: string) => {
    setCategory(id)
    const first = CATEGORIES.find((c) => c.id === id)?.services[0] ?? ''
    setServicePick(first)
    setCustomService('')
  }

  const serviceType = servicePick === CUSTOM ? customService.trim() : servicePick

  const setDeliverable = (i: number, value: string) =>
    setDeliverables((prev) => prev.map((d, idx) => (idx === i ? value : d)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          category,
          serviceType,
          description,
          deliverables: deliverables.filter((d) => d.trim()),
          budgetNIM: Number(budget),
          timelineDays: Number(timeline),
          attachments: attachments.filter((a) => a.url.trim()),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `Could not save the posting (${res.status})`)
      // The posting exists as a draft. Publishing it is the funding step, which
      // lives on the detail page next to the escrow it commits.
      router.push(`/dashboard/opportunities/${body.id}?fund=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <>
      <Link
        href="/dashboard/opportunities"
        className="mb-6 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Opportunities
      </Link>

      <PageHeader
        title="Post an opportunity"
        description="Spell out the work. The clearer the brief, the better the proposals — and the more there is for the mediator to hold a freelancer to if it comes to that."
      />

      {hiring && (
        <div className="mb-6 rounded-lg border border-accent/25 bg-accent/[0.06] p-4">
          <p className="text-[13px] leading-relaxed text-secondary-foreground">
            Filled in from {hiring.name}&apos;s advertisement. Edit anything you like, then commit
            the budget to escrow — they still have to accept before the work starts.
          </p>
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="space-y-6 p-6">
          <Field label="Title" hint="One line a freelancer can scan on the board.">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Landing page for a Nimiq wallet tool"
              maxLength={140}
              required
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Category">
              <Select value={category} onChange={(e) => pickCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Service type">
              <Select value={servicePick} onChange={(e) => setServicePick(e.target.value)}>
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
                  maxLength={80}
                  className="mt-2"
                  required
                />
              )}
            </Field>
          </div>

          <Field
            label="Detailed description"
            hint="Scope, context, what done looks like, anything a freelancer would otherwise have to ask."
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={7}
              placeholder="We need a single-page site for our wallet analytics tool. Copy and brand assets are ready; we need layout, build, and deploy to Vercel. Must be responsive down to 360px and score 90+ on Lighthouse performance."
              required
            />
            <p className="mt-1.5 text-right text-[12px] text-subtle-foreground">
              {description.trim().length}/30 minimum
            </p>
          </Field>

          <Field
            label="Deliverables"
            hint="The itemised list the work is judged against — by the client, and by the mediator in a dispute."
          >
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={d}
                    onChange={(e) => setDeliverable(i, e.target.value)}
                    placeholder={i === 0 ? 'Responsive landing page, deployed' : 'Another deliverable'}
                    maxLength={200}
                    className="py-2.5"
                  />
                  {deliverables.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove deliverable"
                      onClick={() => setDeliverables((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex h-auto w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {deliverables.length < MAX_DELIVERABLES && (
              <button
                type="button"
                onClick={() => setDeliverables((prev) => [...prev, ''])}
                className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add deliverable
              </button>
            )}
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Budget (NIM)" hint="Committed to escrow before the posting goes live.">
              <Input
                type="number"
                inputMode="decimal"
                min="1"
                step="any"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="500"
                required
              />
            </Field>
            <Field label="Timeline (days)" hint="How long you are giving the work.">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="7"
                required
              />
            </Field>
          </div>

          <Field
            label="Attachments"
            hint="Links to briefs, designs, or repos. There is no file store in this build, so paste a URL a freelancer can open."
          >
            {attachments.length > 0 && (
              <div className="mb-2 space-y-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={a.label}
                      onChange={(e) =>
                        setAttachments((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      placeholder="Brand guide"
                      maxLength={80}
                      className="w-1/3 py-2.5"
                    />
                    <Input
                      value={a.url}
                      onChange={(e) =>
                        setAttachments((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                        )
                      }
                      placeholder="https://…"
                      type="url"
                      className="py-2.5"
                    />
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachments.length < 6 && (
              <button
                type="button"
                onClick={() => setAttachments((prev) => [...prev, { label: '', url: '' }])}
                className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Add a link
              </button>
            )}
          </Field>

          {error && <p className="text-[13px] text-destructive">{error}</p>}

          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4" />}
              {saving ? 'Saving' : 'Continue to funding'}
            </Button>
            <span className="text-[12px] text-subtle-foreground">
              Nothing is public until you commit the budget.
            </span>
          </div>
        </form>
      </Card>
    </>
  )
}
