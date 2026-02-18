/**
 * Result of composite file validation.
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Checks whether file MIME type is in allowed list.
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) {
    return true
  }

  return allowedTypes.includes(file.type)
}

/**
 * Checks whether file size does not exceed provided byte limit.
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  if (!Number.isFinite(maxSizeBytes) || maxSizeBytes <= 0) {
    return false
  }

  return file.size <= maxSizeBytes
}

/**
 * Formats byte count to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} ${units[unitIndex]}`
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Produces data URL preview for an image file.
 */
export function generateImagePreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to generate image preview'))
    }

    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Returns lowercase extension without the dot.
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')

  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return ''
  }

  return filename.slice(lastDot + 1).toLowerCase()
}

/**
 * Performs all enabled file checks and returns first validation error.
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number
    allowedTypes?: string[]
  }
): FileValidationResult {
  const { maxSize, allowedTypes } = options

  if (Array.isArray(allowedTypes) && allowedTypes.length > 0 && !validateFileType(file, allowedTypes)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
    }
  }

  if (typeof maxSize === 'number' && !validateFileSize(file, maxSize)) {
    return {
      valid: false,
      error: `File size exceeds limit (${formatFileSize(maxSize)})`,
    }
  }

  return { valid: true }
}