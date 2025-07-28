import slugify from 'slugify'
import { nanoid } from 'nanoid'

export function generateSlug(text: string): string {
  // Generate a slug from the text using slugify
  const baseSlug = slugify(text, { lower: true, strict: true })

  // Append a unique identifier to ensure uniqueness
  return `${baseSlug}-${nanoid(6)}`
}
