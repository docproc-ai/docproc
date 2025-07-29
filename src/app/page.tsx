import { redirect } from 'next/navigation'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'

export default function HomePage() {
  redirect('/document-types')

  return <PageLoadingSkeleton />
}
