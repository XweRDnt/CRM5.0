/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import {
  validateFileType,
  validateFileSize,
  formatFileSize,
  generateImagePreview,
  getFileExtension,
  validateFile,
} from '../upload'

describe('upload', () => {
  describe('validateFileType', () => {
    it('should validate allowed file types', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      expect(validateFileType(file, ['image/jpeg', 'image/png'])).toBe(true)
    })

    it('should reject disallowed file types', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/exe' })
      expect(validateFileType(file, ['image/jpeg', 'image/png'])).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should validate file within size limit', () => {
      const file = new File(['x'.repeat(1000)], 'test.txt')
      expect(validateFileSize(file, 2000)).toBe(true)
    })

    it('should reject file exceeding size limit', () => {
      const file = new File(['x'.repeat(5000)], 'test.txt')
      expect(validateFileSize(file, 1000)).toBe(false)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B')
      expect(formatFileSize(1024)).toBe('1.00 KB')
      expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
      expect(formatFileSize(1536 * 1024)).toBe('1.50 MB')
    })
  })

  describe('generateImagePreview', () => {
    it('should generate data URL preview', async () => {
      const file = new File(['image'], 'test.png', { type: 'image/png' })
      const preview = await generateImagePreview(file)
      expect(preview.startsWith('data:image/png;base64,')).toBe(true)
    })

    it('should reject on file reader error', async () => {
      const file = new File(['image'], 'test.png', { type: 'image/png' })
      const readAsDataURL = vi
        .spyOn(FileReader.prototype, 'readAsDataURL')
        .mockImplementation(function mockRead(this: FileReader) {
          this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
        })

      await expect(generateImagePreview(file)).rejects.toBeTruthy()
      readAsDataURL.mockRestore()
    })
  })

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('test.jpg')).toBe('jpg')
      expect(getFileExtension('document.pdf')).toBe('pdf')
      expect(getFileExtension('archive.tar.gz')).toBe('gz')
    })

    it('should handle files without extension', () => {
      expect(getFileExtension('README')).toBe('')
    })
  })

  describe('validateFile', () => {
    it('should validate file with all checks', () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      const result = validateFile(file, {
        maxSize: 1000,
        allowedTypes: ['image/jpeg'],
      })
      expect(result.valid).toBe(true)
    })

    it('should fail on size limit', () => {
      const file = new File(['x'.repeat(5000)], 'test.jpg', { type: 'image/jpeg' })
      const result = validateFile(file, {
        maxSize: 1000,
        allowedTypes: ['image/jpeg'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('size')
    })

    it('should fail on file type', () => {
      const file = new File(['content'], 'test.exe', { type: 'application/exe' })
      const result = validateFile(file, {
        allowedTypes: ['image/jpeg'],
      })
      expect(result.valid).toBe(false)
      expect(result.error).toContain('type')
    })
  })
})
