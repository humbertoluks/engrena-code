import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES, estimateBase64ByteLength, validateComposerImages } from './composer-images.js'

function base64OfLength(byteLength: number): string {
  return Buffer.alloc(byteLength, 1).toString('base64')
}

describe('estimateBase64ByteLength', () => {
  it('matches Buffer decode length for various sizes', () => {
    for (const n of [0, 1, 2, 3, 10, 4096]) {
      const b64 = base64OfLength(n)
      expect(estimateBase64ByteLength(b64)).toBe(n)
    }
  })
})

describe('test_validate_composer_images', () => {
  it('accepts a valid small png', () => {
    const err = validateComposerImages([{ mimeType: 'image/png', name: 'a.png', dataBase64: base64OfLength(10) }])
    expect(err).toBeNull()
  })

  it('accepts an empty list', () => {
    expect(validateComposerImages([])).toBeNull()
  })

  it('rejects a non-array payload', () => {
    expect(validateComposerImages('nope')?.code).toBe('validation_error')
  })

  describe('test_images_reject_more_than_five', () => {
    it('rejects more than 5 images with image_limit_exceeded', () => {
      const images = Array.from({ length: 6 }, (_, i) => ({
        mimeType: 'image/png',
        name: `img-${i}.png`,
        dataBase64: base64OfLength(10),
      }))
      expect(validateComposerImages(images)?.code).toBe('image_limit_exceeded')
    })
  })

  describe('test_images_reject_oversize_and_bad_mime', () => {
    it('rejects an image over 4 MiB with image_too_large', () => {
      const err = validateComposerImages([
        { mimeType: 'image/png', name: 'big.png', dataBase64: base64OfLength(MAX_IMAGE_BYTES + 1) },
      ])
      expect(err?.code).toBe('image_too_large')
    })

    it('rejects a disallowed mime type with image_type_invalid', () => {
      const err = validateComposerImages([
        { mimeType: 'application/pdf', name: 'doc.pdf', dataBase64: base64OfLength(10) },
      ])
      expect(err?.code).toBe('image_type_invalid')
    })
  })

  it('rejects an image with empty dataBase64', () => {
    const err = validateComposerImages([{ mimeType: 'image/png', name: 'empty.png', dataBase64: '' }])
    expect(err?.code).toBe('validation_error')
  })
})
