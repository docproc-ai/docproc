# Document Types (Target)

## Overview

Document Types remain largely unchanged from the current implementation. The main difference is OpenRouter-only model configuration.

## Changes from Current

| Aspect | Current | Target |
|--------|---------|--------|
| AI provider config | `providerName` + `modelName` | `modelName` only (OpenRouter format) |
| Schema format | Same | Same |
| Webhooks | Same | Same |
| Validation | Same | Same |

## Data Model

```typescript
interface DocumentType {
  id: string
  name: string
  slug: string
  schema: JsonSchema
  webhookConfig: WebhookConfig         // Unchanged
  validationInstructions: string       // Unchanged
  modelName: string                    // OpenRouter model ID
  // Removed: providerName (always OpenRouter)
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}
```

## Model Configuration

### OpenRouter Model Format

Models are specified in OpenRouter format: `provider/model-name`

```typescript
// Examples
'anthropic/claude-3.5-sonnet'
'anthropic/claude-3-opus'
'openai/gpt-4o'
'openai/gpt-4-turbo'
'google/gemini-pro-vision'
'meta-llama/llama-3.1-405b-instruct'
```

### Default Model

```env
OPENROUTER_DEFAULT_MODEL=anthropic/claude-3.5-sonnet
```

Used when document type doesn't specify a model.

### Model Selection UI

```typescript
// Fetch available models from OpenRouter
const models = await fetch('https://openrouter.ai/api/v1/models', {
  headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }
}).then(r => r.json())

// Filter for vision-capable models
const visionModels = models.data.filter(m =>
  m.architecture?.modality?.includes('image')
)
```

## Schema Definition

JSON Schema format is unchanged. See [current spec](../spec/03-document-types.md) for details.

### Example

```json
{
  "type": "object",
  "title": "Invoice",
  "properties": {
    "invoiceNumber": {
      "type": "string",
      "title": "Invoice Number"
    },
    "date": {
      "type": "string",
      "format": "date",
      "title": "Invoice Date"
    },
    "lineItems": {
      "type": "array",
      "title": "Line Items",
      "ui:widget": "table",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "quantity": { "type": "integer" },
          "total": { "type": "number" }
        }
      }
    },
    "total": {
      "type": "number",
      "title": "Total"
    }
  },
  "required": ["invoiceNumber", "total"]
}
```

## API Endpoints

### Create Document Type

```typescript
// POST /api/document-types
app.post('/api/document-types', requireAuth, requirePermission('documentType:create'), async (c) => {
  const body = await c.req.json()

  const docType = await db.insert(documentTypes).values({
    id: crypto.randomUUID(),
    name: body.name,
    slug: slugify(body.name),
    schema: body.schema,
    validationInstructions: body.validationInstructions,
    modelName: body.modelName || process.env.OPENROUTER_DEFAULT_MODEL,
    webhookConfig: body.webhookConfig,
    createdBy: c.get('user').id,
  }).returning()

  return c.json(docType[0])
})
```

### Update Document Type

```typescript
// PUT /api/document-types/:id
app.put('/api/document-types/:id', requireAuth, requirePermission('documentType:update'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const docType = await db.update(documentTypes)
    .set({
      name: body.name,
      schema: body.schema,
      validationInstructions: body.validationInstructions,
      modelName: body.modelName,
      webhookConfig: body.webhookConfig,
      updatedBy: c.get('user').id,
      updatedAt: new Date(),
    })
    .where(eq(documentTypes.id, id))
    .returning()

  return c.json(docType[0])
})
```

## Validation Instructions

Unchanged from current. Plain text instructions for AI validation:

```
Validate that this document is an invoice. Check for:
- Invoice number or reference
- Date
- Vendor information
- Line items or charges
- Total amount

Reject if the document appears to be a quote, purchase order, or receipt.
```

## Webhooks

Webhook configuration is unchanged. See [Webhooks spec](./08-webhooks.md).

## Database Schema

```sql
CREATE TABLE document_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  schema JSONB NOT NULL,
  webhook_config JSONB,
  validation_instructions TEXT,
  model_name TEXT,  -- OpenRouter model ID
  -- Removed: provider_name
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT REFERENCES "user"(id),
  updated_by TEXT REFERENCES "user"(id)
);
```

## Migration Notes

### From Current to Target

```sql
-- Combine provider_name and model_name into OpenRouter format
UPDATE document_types
SET model_name = CASE
  WHEN provider_name = 'anthropic' THEN 'anthropic/' || model_name
  WHEN provider_name = 'openrouter' THEN model_name
  ELSE 'anthropic/claude-3.5-sonnet'  -- default
END;

-- Remove provider_name column
ALTER TABLE document_types DROP COLUMN provider_name;
```
