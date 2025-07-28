'use client'
import { useState, useRef, useEffect, useCallback, memo } from 'react'

import { FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Document, pdfjs } from 'react-pdf'
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch'
import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  file: {
    name: string
    url: string
    type: string
  } | null
  onPageRender?: (dataUrl: string | null) => void
}

const DocumentViewerComponent = ({ file, onPageRender }: DocumentViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageImage, setPageImage] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef | null>(null)

  useEffect(() => {
    if (!file || !file.url) {
      setFileUrl(null)
      onPageRender?.(null)
      return
    }

    setFileUrl(file.url)
    setCurrentPage(1)
    setPageImage(null)
    setNumPages(null)
    pdfRef.current = null
    onPageRender?.(null)
  }, [file, onPageRender])

  const onDocumentLoadSuccess = useCallback((pdf: pdfjs.PDFDocumentProxy) => {
    pdfRef.current = pdf
    setNumPages(pdf.numPages)
  }, [])

  useEffect(() => {
    if (!pdfRef.current || !numPages) return

    let isMounted = true
    const renderPage = async () => {
      setIsRendering(true)
      onPageRender?.(null)
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

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise
        if (isMounted) {
          const dataUrl = canvas.toDataURL('image/png')
          setPageImage(dataUrl)
          onPageRender?.(dataUrl)
        }
      } catch (error) {
        console.error('Failed to render page:', error)
        if (isMounted) {
          setPageImage(null)
          onPageRender?.(null)
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
  }, [currentPage, numPages, onPageRender])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (transformWrapperRef.current) {
        transformWrapperRef.current.centerView()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [pageImage, fileUrl])

  const goToPrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, numPages || 1))
  }

  const renderPdf = () => (
    <div className="flex h-full w-full flex-col">
      <div className="bg-muted/20 relative flex-grow overflow-hidden">
        <div style={{ display: 'none' }}>
          {fileUrl && (
            <Document key={fileUrl} file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} />
          )}
        </div>

        {(isRendering || !pageImage) && (
          <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        )}

        {pageImage && (
          <TransformWrapper ref={transformWrapperRef} limitToBounds={false}>
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%' }}
            >
              <img
                src={pageImage || '/placeholder.svg'}
                alt={`Page ${currentPage}`}
                className="h-full w-full object-contain"
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
      {numPages && numPages > 1 && (
        <div className="border-border flex flex-shrink-0 items-center justify-center gap-4 border-t p-2">
          <Button variant="ghost" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-muted-foreground text-sm font-medium">
            Page {currentPage} of {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )

  const renderImage = () => (
    <div className="bg-muted/20 h-full w-full overflow-hidden">
      <TransformWrapper ref={transformWrapperRef} limitToBounds={false}>
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <img
            src={fileUrl! || '/placeholder.svg'}
            alt={file?.name}
            className="h-full w-full object-contain shadow-lg"
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )

  const isImage = file?.type.startsWith('image/')
  const isPdf = file?.type === 'application/pdf'

  return (
    <div className="relative h-full w-full bg-muted/50">
      {!file ? (
        <div className="flex h-full flex-col items-center justify-center">
          <FileText className="text-muted-foreground h-12 w-12" />
        </div>
      ) : isImage ? (
        renderImage()
      ) : isPdf ? (
        renderPdf()
      ) : (
        <div className="flex h-full flex-col items-center justify-center">
          <FileText className="text-muted-foreground h-12 w-12" />
          <p className="text-muted-foreground mt-4">Preview for '{file.name}' is not available.</p>
        </div>
      )}
    </div>
  )
}

DocumentViewerComponent.displayName = 'DocumentViewerComponent'

export default memo(DocumentViewerComponent)
