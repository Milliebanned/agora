import { redirect } from 'next/navigation'

// The old agreement workspace was folded into the opportunity detail page, so
// one record has one URL for its whole life. Anything still pointing here —
// bookmarks, old system messages — lands in the right place.
export default async function LegacyAgreementPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/dashboard/opportunities/${id}`)
}
