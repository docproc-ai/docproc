/**
 * Generate a URL-friendly slug from text with a unique suffix
 */
export function generateSlug(text: string): string {
  const baseSlug = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens from start/end

  // Generate a short unique suffix using crypto
  const uniqueId = crypto.randomUUID().slice(0, 6)

  return `${baseSlug}-${uniqueId}`
}
