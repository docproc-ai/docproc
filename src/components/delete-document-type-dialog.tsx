'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteDocumentType } from '@/lib/actions/document-type'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface DeleteDocumentTypeDialogProps {
  documentTypeId: string
  documentTypeName: string
}

export function DeleteDocumentTypeDialog({
  documentTypeId,
  documentTypeName,
}: DeleteDocumentTypeDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteDocumentType(documentTypeId)

      toast.success(`Document type "${documentTypeName}" and all its documents have been deleted.`)
      setIsOpen(false)
      router.push('/document-types') // Go back to the list after deletion
      router.refresh()
    } catch (error: any) {
      toast.error(`Delete Error: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action is permanent. It will delete the document type "{documentTypeName}" and{' '}
            <strong>all of its associated documents and files</strong> from storage. This cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isLoading}>
            {isLoading && <Spinner />}
            Yes, delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
