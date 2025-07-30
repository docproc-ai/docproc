# Document Processor Custom Streaming Implementation

## Overview

Successfully implemented granular streaming document processing using a custom text streaming solution with incremental JSON parsing. This implementation provides real-time updates on every chunk rather than waiting for complete top-level keys, offering the most responsive user experience possible.

## What Was Implemented

### 1. New API Route (`/api/process-document/route.ts`)
- **Purpose**: Handles streaming document processing requests
- **Features**:
  - Uses `streamText` from AI SDK for granular text streaming
  - Includes schema in prompt for JSON structure guidance
  - Supports all existing functionality (model override, admin permissions, etc.)
  - Handles both PDF and image documents
  - Returns raw text stream for custom parsing

### 2. Custom Streaming Hook (`/src/hooks/use-streaming-json.tsx`)
- **Purpose**: Parses streaming JSON incrementally on every chunk using `jsonrepair`
- **Features**:
  - Real-time JSON parsing with incomplete object handling using `jsonrepair` library
  - Robust handling of malformed JSON, nested objects, arrays, and complex structures
  - Session-isolated parsing (no data carryover between documents)
  - Incremental growth validation (prevents flashing/regression)
  - Abort controller for cancellation support
  - Error handling and recovery

### 3. Updated Document Processor Component
- **Streaming Integration**: Replaced `useObject` with custom `useStreamingJson` hook
- **Granular Updates**: Form fields update on every text chunk, not just complete keys
- **Visual Feedback**: 
  - Loading indicators during processing
  - Error states with clear messaging
  - Stop button to cancel streaming
- **Preserved Functionality**: All existing features maintained

## Key Features

### ✅ Real-time Streaming
- Data appears in form fields as it's extracted
- JSON view updates live during processing
- No waiting for complete processing before seeing results

### ✅ User Experience Improvements
- **Process Button**: Starts streaming extraction
- **Stop Button**: Appears during processing to cancel stream
- **Loading States**: Clear visual indicators
- **Error Handling**: Comprehensive error display
- **Progress Feedback**: Users see data being extracted in real-time

### ✅ Backward Compatibility
- All existing functionality preserved
- Admin model override still works
- Document status management unchanged
- File upload and management unchanged

## How It Works

1. **User clicks "Process"** → `handleAiProcessing()` called
2. **Request prepared** → Document ID, schema, and model sent to API
3. **Text streaming starts** → `streamText` generates JSON character by character
4. **Incremental parsing** → Custom hook parses partial JSON on every chunk
5. **Real-time updates** → Form fields update as each piece of data becomes available
6. **Completion** → Final object saved to document state

## Technical Implementation

### API Route Structure
```typescript
// Streams text generation using AI SDK
const result = streamText({
  model: anthropic(modelToUse),
  system: SYSTEM_PROMPT,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Please analyze the attached document and extract the data according to the provided schema.

Schema to follow:
${JSON.stringify(schema, null, 2)}

Remember: Output ONLY valid JSON that matches this schema. No explanatory text.`,
        },
        // ... file/image content
      ],
    },
  ],
})

return result.toTextStreamResponse()
```

### Custom Streaming Hook
```typescript
// Custom hook for granular JSON streaming
const { object, submit, isLoading, stop, error } = useStreamingJson({
  api: '/api/process-document',
  onUpdate: (partialObject) => {
    // Update form data on every chunk
    setFormData(partialObject)
  },
  onFinish: (finalObject) => {
    // Update document state with final result
  },
  onError: (error) => {
    // Handle errors
  },
})

// Incremental JSON parsing using jsonrepair
const parsePartialJson = (text: string) => {
  try {
    return JSON.parse(text) // Try complete JSON first
  } catch {
    // Use jsonrepair to fix malformed JSON
    try {
      const repairedJson = jsonrepair(text)
      const parsed = JSON.parse(repairedJson)
      
      // Only return if the new object is growing (prevents flashing)
      if (currentSessionObjectRef.current && !isObjectGrowing(currentSessionObjectRef.current, parsed)) {
        return currentSessionObjectRef.current
      }
      
      return parsed
    } catch {
      return currentSessionObjectRef.current // Fallback to previous object
    }
  }
}
```

### Component Integration
```typescript
// Real-time form updates on every chunk
React.useEffect(() => {
  if (object) {
    setFormData(object)
  }
}, [object])
```

## Testing the Implementation

### Prerequisites
1. Ensure the Next.js app is running (`npm run dev`)
2. Have documents uploaded to a document type
3. Ensure AI model credentials are configured

### Test Steps
1. **Navigate** to a document type processing page
2. **Select** a document from the queue
3. **Click "Process"** button
4. **Observe**:
   - Button changes to "Stop" with square icon
   - Blue loading banner appears
   - Form fields populate in real-time as data streams
   - JSON view updates live in the "Data" tab
5. **Completion**:
   - Loading indicators disappear
   - Success toast appears
   - Document status updates to "processed"

### Expected Behavior
- **Immediate feedback**: Loading states appear instantly
- **Progressive updates**: Form fields fill as data is extracted
- **Smooth experience**: No page refreshes or blocking operations
- **Error handling**: Clear error messages if something goes wrong
- **Cancellation**: Stop button works to cancel processing

## Benefits Over Previous Implementation

1. **Granular Updates**: Updates on every text chunk, not just complete top-level keys
2. **Better UX**: Users see progress character by character as JSON is built
3. **Faster perceived performance**: Data appears immediately as extracted
4. **Cancellation support**: Users can stop long-running processes
5. **Error visibility**: Real-time error feedback
6. **Custom parsing**: Smart handling of incomplete JSON structures
7. **More responsive**: No waiting for object boundaries

## Benefits Over Standard `useObject` Hook

1. **Chunk-level updates**: Standard `useObject` only updates when complete top-level keys are received
2. **Custom parsing logic**: Our implementation handles partial JSON more intelligently
3. **Immediate feedback**: Users see partial data as it's being generated
4. **Better error recovery**: Smart completion of incomplete JSON structures
5. **More control**: Custom abort handling and error management

## Files Modified

1. **`/src/app/api/process-document/route.ts`** - New streaming API endpoint using `streamText`
2. **`/src/hooks/use-streaming-json.tsx`** - New custom streaming hook with incremental JSON parsing
3. **`/src/components/document-processor.tsx`** - Updated to use custom streaming hook
4. **`/src/lib/actions/process.ts`** - Original functions preserved for reference

## Notes

- The original `processDocument` and `processDocumentStream` functions in `/src/lib/actions/process.ts` are preserved but no longer used
- All existing server actions for document management remain unchanged
- The implementation follows AI SDK v5 best practices
- Streaming works with all supported document types (PDF, images)
- Admin model override functionality is fully preserved

## Future Enhancements

Potential improvements that could be added:
1. **Progress indicators**: Show percentage of fields completed
2. **Field-level streaming**: Highlight fields as they're populated
3. **Retry mechanism**: Automatic retry on stream failures
4. **Batch processing**: Stream multiple documents simultaneously
5. **Custom streaming speeds**: Adjust streaming rate based on user preference
