import {
  ChevronLeft,
  ChevronRight,
  File,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Document, pdfjs } from 'react-pdf'
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from 'react-zoom-pan-pinch'
import { Button } from '@/components/ui/button'

// Configure pdfjs worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentViewerProps {
  documentId: string
  filename: string
  onRotate?: (degrees: number, pageNumber?: number) => Promise<void>
}

function DocumentViewerComponent({
  documentId,
  filename,
  onRotate,
}: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageImage, setPageImage] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [fileVersion, setFileVersion] = useState(0)
  const [showSpinner, setShowSpinner] = useState(false)
  // For images: optimistic rotation angle (CSS transform)
  const [imageRotation, setImageRotation] = useState(0)
  // Track if we're actively rotating (vs resetting on document change) for transition
  const [isRotating, setIsRotating] = useState(false)
  // Track image natural dimensions for proper scaling when rotated sideways
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  // Track container dimensions for proper scale calculation
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const transformWrapperRef = useRef<ReactZoomPanPinchRef | null>(null)
  const skipNextRenderRef = useRef(false)

  // Build file URL with cache busting
  const fileUrl = `/api/documents/${documentId}/file?v=${fileVersion}`

  // Determine file type from filename extension
  const fileExtension = filename.toLowerCase().split('.').pop()
  const isPdf = fileExtension === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'].includes(
    fileExtension || '',
  )

  // Reset state when document changes
  useEffect(() => {
    setCurrentPage(1)
    setPageImage(null)
    setNumPages(null)
    pdfRef.current = null
    skipNextRenderRef.current = false
    setFileVersion(0)
    setImageRotation(0)
    setImageDimensions(null)
    // Don't reset containerDimensions - it's independent of the document
    // Clear any pending rotation request
    if (rotateDebounceRef.current) {
      clearTimeout(rotateDebounceRef.current)
      rotateDebounceRef.current = null
    }
    pendingRotationRef.current = 0
  }, [documentId])

  // Track container size for proper rotation scaling
  useEffect(() => {
    if (!imageContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    observer.observe(imageContainerRef.current)
    return () => observer.disconnect()
  }, [])

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
        const page = await pdfRef.current?.getPage(currentPage)
        if (!page) {
          throw new Error('Could not load page')
        }
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
          if (skipNextRenderRef.current) {
            skipNextRenderRef.current = false
          } else {
            setPageImage(canvas.toDataURL('image/png'))
          }
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
  }, [currentPage, numPages])

  // Center view when content changes
  useEffect(() => {
    const timer = setTimeout(() => {
      transformWrapperRef.current?.centerView()
    }, 50)
    return () => clearTimeout(timer)
  }, [pageImage, imageRotation])

  // Delay showing spinner to avoid flash on quick loads
  useEffect(() => {
    const shouldShowSpinner = isRendering || !pageImage
    if (shouldShowSpinner) {
      const timer = setTimeout(() => setShowSpinner(true), 500)
      return () => clearTimeout(timer)
    } else {
      setShowSpinner(false)
    }
  }, [isRendering, pageImage])

  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, numPages || 1))

  // Rotate image using canvas - handles dimension swap
  const rotateWithCanvas = (img: HTMLImageElement, degrees: number): string => {
    const canvas = document.createElement('canvas')
    const normalizedDegrees = ((degrees % 360) + 360) % 360
    const isRightAngle = normalizedDegrees === 90 || normalizedDegrees === 270

    // Swap dimensions for 90/270 degree rotations
    canvas.width = isRightAngle ? img.naturalHeight : img.naturalWidth
    canvas.height = isRightAngle ? img.naturalWidth : img.naturalHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')

    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((normalizedDegrees * Math.PI) / 180)
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

    // JPEG encoding is much faster than PNG for large images
    return canvas.toDataURL('image/jpeg', 0.92)
  }

  // Cumulative rotation tracking for canvas operations
  const cumulativeRotationRef = useRef(0)
  // Debounce timer for backend rotation requests
  const rotateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Pending rotation degrees to send to backend
  const pendingRotationRef = useRef(0)

  const handleRotate = (degrees: number) => {
    if (!onRotate) return

    // Update cumulative rotation
    cumulativeRotationRef.current =
      (cumulativeRotationRef.current + degrees) % 360

    // For PDFs: rotate the pageImage
    if (isPdf && pageImage) {
      const img = new Image()
      img.onload = () => {
        try {
          const rotated = rotateWithCanvas(img, degrees)
          setPageImage(rotated)
        } catch (e) {
          console.error('Failed to rotate PDF page:', e)
        }
      }
      img.src = pageImage
    }

    // For images: just update the CSS rotation angle (instant)
    // Don't normalize - let it accumulate so CSS transitions go the right direction
    if (isImage) {
      setIsRotating(true)
      setImageRotation((prev) => prev + degrees)
      // Reset after transition completes (150ms)
      setTimeout(() => setIsRotating(false), 200)
    }

    // Debounce backend request - accumulate rotations and send once
    pendingRotationRef.current += degrees
    if (rotateDebounceRef.current) {
      clearTimeout(rotateDebounceRef.current)
    }
    rotateDebounceRef.current = setTimeout(() => {
      const totalRotation = pendingRotationRef.current
      pendingRotationRef.current = 0
      // Normalize to -270 to 270 range (skip full rotations)
      const normalized = ((totalRotation % 360) + 360) % 360
      if (normalized !== 0) {
        onRotate(
          normalized > 180 ? normalized - 360 : normalized,
          isPdf ? currentPage : undefined,
        ).catch((error) => {
          console.error('Failed to rotate on backend:', error)
        })
      }
    }, 300)
  }

  // Render controls bar
  const renderControls = (showPageNav: boolean) => (
    <div className="flex items-center justify-center gap-2 px-3 py-2 border-t bg-background/80 backdrop-blur-sm">
      {showPageNav && numPages && numPages > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToPrevPage}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}

      {onRotate && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleRotate(-90)}
            title="Rotate counterclockwise"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleRotate(90)}
            title="Rotate clockwise"
          >
            <RotateCw className="size-4" />
          </Button>
        </>
      )}

      <span className="text-xs text-muted-foreground px-2">
        {showPageNav && numPages
          ? `Page ${currentPage} of ${numPages}`
          : isPdf
            ? 'PDF'
            : 'Image'}
      </span>

      {showPageNav && numPages && numPages > 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={goToNextPage}
          disabled={currentPage >= numPages}
        >
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  )

  // PDF rendering
  const renderPdf = () => (
    <div className="flex h-full w-full flex-col">
      <div className="relative grow overflow-hidden bg-muted/30">
        <div style={{ display: 'none' }}>
          <Document
            key={fileUrl}
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
          />
        </div>

        {showSpinner && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {pageImage && (
          <TransformWrapper
            ref={transformWrapperRef}
            limitToBounds={false}
            panning={{ velocityDisabled: true }}
          >
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
              />
            </TransformComponent>
          </TransformWrapper>
        )}
      </div>
      {renderControls(true)}
    </div>
  )

  // Image rendering
  const renderImage = () => {
    // For 90°/270° rotations, calculate scale to fit the swapped dimensions
    const normalizedRotation = ((imageRotation % 360) + 360) % 360
    const isRotatedSideways =
      normalizedRotation === 90 || normalizedRotation === 270

    let scale = 1
    if (isRotatedSideways && imageDimensions && containerDimensions) {
      const { width: iw, height: ih } = imageDimensions
      const { width: cw, height: ch } = containerDimensions
      // Original fit scale (how the image fits before rotation)
      const originalFit = Math.min(cw / iw, ch / ih)
      // Rotated fit scale (how the image should fit after rotation, with swapped dimensions)
      const rotatedFit = Math.min(cw / ih, ch / iw)
      // CSS scale to apply = ratio of the two
      scale = rotatedFit / originalFit
    }

    return (
      <div className="flex h-full w-full flex-col">
        <div
          ref={imageContainerRef}
          className="relative grow overflow-hidden bg-muted/30"
        >
          <TransformWrapper
            ref={transformWrapperRef}
            limitToBounds={false}
            panning={{ velocityDisabled: true }}
          >
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
                className={`max-w-full max-h-full object-contain ${isRotating ? 'transition-transform duration-150' : ''}`}
                style={{
                  transform: `rotate(${imageRotation}deg) scale(${scale})`,
                }}
                onLoad={(e) => {
                  const img = e.currentTarget
                  setImageDimensions({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  })
                }}
              />
            </TransformComponent>
          </TransformWrapper>
        </div>
        {renderControls(false)}
      </div>
    )
  }

  // Unsupported file type
  const renderUnsupported = () => (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
      <File className="size-12" />
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
