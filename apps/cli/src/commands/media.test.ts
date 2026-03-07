import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadHandler, getHandler, searchHandler, viewHandler } from './media'
import * as orpcClient from '../orpc-client'
import fs from 'node:fs/promises'

vi.mock('../orpc-client', () => ({
  getClient: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('media handlers', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getHandler', () => {
    it('should fetch media metadata', async () => {
      const mockMedia = { id: 'media-1', originalFileName: 'test.jpg' }
      const mockGet = vi.fn().mockResolvedValue(mockMedia)
      const mockRpc = { media: { get: mockGet } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      const context = {
        args: { id: 'media-1' },
        options: { remote: 'http://test.local' },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      }

      const result = await getHandler(context)
      expect(mockGet).toHaveBeenCalledWith({ id: 'media-1' })
      expect(context.ok).toHaveBeenCalledWith({ media: mockMedia })
      expect(result).toEqual({ media: mockMedia })
    })

    it('should handle errors', async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error('Fetch failed'))
      const mockRpc = { media: { get: mockGet } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      const context = {
        args: { id: 'media-1' },
        options: { remote: 'http://test.local' },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      }

      const result = await getHandler(context)
      expect(context.error).toHaveBeenCalledWith({
        code: 'FETCH_ERROR',
        message: 'Fetch failed',
      })
      expect(result).toEqual({ code: 'FETCH_ERROR', message: 'Fetch failed' })
    })
  })

  describe('searchHandler', () => {
    it('should search media with correct arguments', async () => {
      const mockResult = { total: 1, items: [{ id: 'media-1' }] }
      const mockList = vi.fn().mockResolvedValue(mockResult)
      const mockRpc = { media: { list: mockList } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      const context = {
        options: { remote: 'http://test.local', query: 'test', limit: 10, offset: 0 },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      }

      const result = await searchHandler(context)
      expect(mockList).toHaveBeenCalledWith({
        query: 'test',
        limit: 10,
        offset: 0,
        sort: 'date_desc',
      })
      expect(context.ok).toHaveBeenCalledWith({ total: 1, items: [{ id: 'media-1' }] })
      expect(result).toEqual({ total: 1, items: [{ id: 'media-1' }] })
    })
  })

  describe('downloadHandler', () => {
    it('should download media and save it with original filename', async () => {
      const mockMedia = { id: 'media-uuid', originalFileName: 'test.jpg' }
      const mockGet = vi.fn().mockResolvedValue(mockMedia)
      const mockRpc = {
        media: {
          get: mockGet,
        },
      }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      const mockBuffer = Buffer.from('fake-binary-data')
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
      })

      const context = {
        args: { id: 'media-uuid' },
        options: { remote: 'http://test.local' },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      }

      const result: any = await downloadHandler(context)

      expect(orpcClient.getClient).toHaveBeenCalledWith('http://test.local')
      expect(mockGet).toHaveBeenCalledWith({ id: 'media-uuid' })
      expect(mockFetch).toHaveBeenCalledWith(new URL('/api/media/media-uuid/original', 'http://test.local').toString())
      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('test.jpg'), expect.any(Buffer))
      expect(context.ok).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('test.jpg'),
        size: mockBuffer.length,
      }))
      expect(result.message).toContain('test.jpg')
    })

    it('should use id as filename if originalFileName is missing', async () => {
      const mockMedia = { id: 'media-uuid' }
      const mockGet = vi.fn().mockResolvedValue(mockMedia)
      const mockRpc = { media: { get: mockGet } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
      })

      const context = {
        args: { id: 'media-uuid' },
        options: { remote: 'http://test.local' },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      }

      await downloadHandler(context)
      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('media-uuid.bin'), expect.any(Buffer))
    })

    it('should use output option as filename if provided', async () => {
      const mockMedia = { id: 'media-uuid', originalFileName: 'test.jpg' }
      const mockGet = vi.fn().mockResolvedValue(mockMedia)
      const mockRpc = { media: { get: mockGet } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
      })

      const context = {
        args: { id: 'media-uuid' },
        options: { remote: 'http://test.local', output: 'custom.png' },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      }

      await downloadHandler(context)
      expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('custom.png'), expect.any(Buffer))
    })

    it('should handle fetch errors', async () => {
      const mockMedia = { id: 'media-uuid' }
      const mockGet = vi.fn().mockResolvedValue(mockMedia)
      const mockRpc = { media: { get: mockGet } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      const context = {
        args: { id: 'media-uuid' },
        options: { remote: 'http://test.local' },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      }

      const result = await downloadHandler(context)
      expect(context.error).toHaveBeenCalledWith({
        code: 'FETCH_ERROR',
        message: 'Failed to fetch media binary: Not Found (404)',
      })
      expect(result).toEqual({
        code: 'FETCH_ERROR',
        message: 'Failed to fetch media binary: Not Found (404)',
      })
    })
  })

  describe('viewHandler dimensions', () => {
    it('should fail on invalid dimensions', async () => {
      const mockMedia = { id: 'media-1' }
      const mockRpc = { media: { get: vi.fn().mockResolvedValue(mockMedia) } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      const context = {
        args: { id: 'media-1' },
        options: { remote: 'http://test.local', width: '50%;inject', height: 'auto' },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      }

      const result = await viewHandler(context)
      expect(context.error).toHaveBeenCalledWith(expect.objectContaining({
        code: 'VIEW_ERROR',
        message: expect.stringContaining('Invalid dimension'),
      }))
    })

    it('should pass on valid dimensions', async () => {
      const mockMedia = { id: 'media-1' }
      const mockRpc = { media: { get: vi.fn().mockResolvedValue(mockMedia) } }
      vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('data')),
      })

      const context = {
        args: { id: 'media-1' },
        options: { remote: 'http://test.local', width: '400px', height: '10%' },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
        agent: false
      }

      // Mock process.stdout.write
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      await viewHandler(context)
      expect(context.ok).toHaveBeenCalledWith({ displayed: true })
      stdoutSpy.mockRestore()
    })
  })
})
