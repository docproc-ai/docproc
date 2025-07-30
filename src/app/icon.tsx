import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size.width}
        height={size.height}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2" // camelCase instead of stroke-width
        strokeLinecap="round" // camelCase instead of stroke-linecap
        strokeLinejoin="round" // camelCase instead of stroke-linejoin
      >
        <path d="M20 13V7l-5-5H6a2 2 0 0 0-2 2v9" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M2 13h20" />
        <path d="M6 20v-3" />
        <path d="M10 22v-5" />
        <path d="M18 20v-3" />
        <path d="M14 19v-2" />
      </svg>
    ),
    {
      ...size,
    },
  )
}
