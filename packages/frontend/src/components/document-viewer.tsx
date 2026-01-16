import { useState, useRef, useEffect, useCallback, memo, useTransition } from 'react'
import { Document, pdfjs } from 'react-pdf'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import { Button } from '@/components/ui/button'

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  documentId: string
  filename: string
  onRotate?: (degrees: number) => Promise<void>
}

function DocumentViewerComponent({ documentId, filename, onRotate }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageImage, setPageImage] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [optimisticRotation, setOptimisticRotation] = useState(0)
  const [fileVersion, setFileVersion] = useState(0)
  const [isPending, startTransition] = useTransition()

  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef | null>(null)

  // Build file URL with cache busting
  const fileUrl = `/api/documents/${documentId}/file?v=${fileVersion}`

  // Determine file type from filename extension
  const fileExtension = filename.toLowerCase().split('.').pop()
  const isPdf = fileExtension === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'].includes(fileExtension || '')

  // Reset state when document changes
  useEffect(() => {
    setCurrentPage(1)
    setPageImage(null)
    setNumPages(null)
    pdfRef.current = null
    setOptimisticRotation(0)
  }, [documentId])

  const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
    pdfRef.current = pdf
    setNumPages(pdf.numPages)
  }, [])

  // Render PDF page to canvas
  useEffect(() => {
    if (!pdfRef.current || !numPages) return

    let isMounted = true
    const renderPage = async () => {
      setIsRendering(true)
      try {
        const page = await pdfRef.current!.getPage(currentPage)
        const scale = 2
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const context = canvas.getContext('2d')

        if (!context) {
          throw new Error('Could not get canvas context')
        }

        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as Parameters<typeof page.render>[0]).promise

        if (isMounted) {
          setPageImage(canvas.toDataURL('image/png'))
        }
      } catch (error) {
        console.error('Failed to render page:', error)
        if (isMounted) {
          setPageImage(null)
        }
      } finally {
        if (isMounted) {
          setIsRendering(false)
        }
      }
    }

    renderPage()

    return () => {
      isMounted = false
    }
  }, [currentPage, numPages, fileVersion])

  // Center view when content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      transformWrapperRef.current?.centerView()
    }, 50)
    return () => clearTimeout(timer)
  }, [pageImage, fileUrl])

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, numPages || 1))

  const handleRotate = async (degrees: number) => {
    if (!onRotate || isPending) return

    // Show rotation immediately (optimistic update)
    setOptimisticRotation((prev) => prev + degrees)

    startTransition(async () => {
      try {
        await onRotate(degrees)
        // Increment file version to bust cache and reload rotated file
        setFileVersion((v) => v + 1)
        // Reset optimistic rotation after server confirms
        setTimeout(() => setOptimisticRotation(0), 300)
      } catch (error) {
        // Revert optimistic update on error
        setOptimisticRotation((prev) => prev - degrees)
        console.error('Failed to rotate:', error)
      }
    })
  }

  // Render controls bar
  const renderControls = (showPageNav: boolean) => (
    <div className="flex items-center justify-center gap-2 px-3 py-2 border-t bg-background/80 backdrop-blur-sm">
      {/* Page navigation for PDFs */}
      {showPageNav && numPages && numPages > 1 && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPrevPage} disabled={currentPage <= 1}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </Button>
      )}

      {/* Rotation buttons */}
      {onRotate && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleRotate(-90)}
            disabled={isPending}
            title="Rotate counterclockwise"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleRotate(90)}
            disabled={isPending}
            title="Rotate clockwise"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </Button>
        </>
      )}

      {/* Page info */}
      <span className="text-xs text-muted-foreground px-2">
        {showPageNav && numPages ? `Page ${currentPage} of ${numPages}` : isPdf ? 'PDF' : 'Image'}
      </span>

      {/* Page navigation for PDFs */}
      {showPageNav && numPages && numPages > 1 && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextPage} disabled={currentPage >= numPages}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </Button>
      )}
    </div>
  )

  // PDF rendering
  const renderPdf = () => (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-grow overflow-hidden bg-muted/30">
        {/* Hidden react-pdf document for loading */}
        <div style={{ display: 'none' }}>
          <Document key={fileUrl} file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} />
        </div>

        {/* Loading spinner */}
        {(isRendering || !pageImage) && !isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {/* Rendered page with pan/zoom */}
        {pageImage && (
          <TransformWrapper ref={transformWrapperRef} limitToBounds={false}>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={pageImage}
                alt={`Page ${currentPage}`}
                className="max-w-full max-h-full object-contain"
                style={{
                  transform: `rotate(${optimisticRotation}deg)`,
                  transition: isPending ? 'none' : 'transform 0.3s ease-out',
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
      {renderControls(true)}
    </div>
  )

  // Image rendering
  const renderImage = () => (
    <div className="flex h-full w-full flex-col">
      <div className="relative flex-grow overflow-hidden bg-muted/30">
        <TransformWrapper ref={transformWrapperRef} limitToBounds={false}>
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              key={fileUrl}
              src={fileUrl}
              alt={filename}
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `rotate(${optimisticRotation}deg)`,
                transition: isPending ? 'none' : 'transform 0.3s ease-out',
              }}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>
      {renderControls(false)}
    </div>
  )

  // Unsupported file type
  const renderUnsupported = () => (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
      </svg>
      <p className="mt-4 text-sm">Preview not available for this file type</p>
      <p className="text-xs mt-1">{filename}</p>
    </div>
  )

  return (
    <div className="h-full w-full bg-muted/50">
      {isPdf ? renderPdf() : isImage ? renderImage() : renderUnsupported()}
    </div>
  )
}

DocumentViewerComponent.displayName = 'DocumentViewer'

export const DocumentViewer = memo(DocumentViewerComponent)
