import { describe, it, expect, vi } from 'vite-plus/test'
import { tagHandler } from './ai'
import * as orpcClient from '../orpc-client'

vi.mock('../orpc-client', () => ({
  getClient: vi.fn(),
}))

describe('ai tagHandler', () => {
  it('should call rpc.ai.tag with correct arguments', async () => {
    const mockTag = vi.fn().mockResolvedValue({ success: true })
    const mockRpc = {
      ai: {
        tag: mockTag,
      },
    }
    vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

    const context = {
      args: { mediaId: 'media-1' },
      options: { remote: 'http://test.local', mediaSourceId: 'source-1' },
      ok: vi.fn((val) => val),
      error: vi.fn((val) => val),
    }

    const result = await tagHandler(context)

    expect(orpcClient.getClient).toHaveBeenCalledWith('http://test.local')
    expect(mockTag).toHaveBeenCalledWith({
      mediaId: 'media-1',
      mediaSourceId: 'source-1',
    })
    expect(context.ok).toHaveBeenCalledWith({ result: { success: true } })
    expect(result).toEqual({ result: { success: true } })
  })

  it('should handle errors from RPC', async () => {
    const mockTag = vi.fn().mockRejectedValue(new Error('RPC failed'))
    const mockRpc = {
      ai: {
        tag: mockTag,
      },
    }
    vi.mocked(orpcClient.getClient).mockReturnValue(mockRpc as any)

    const context = {
      args: { mediaId: 'media-1' },
      options: { remote: 'http://test.local', mediaSourceId: 'source-1' },
      ok: vi.fn(),
      error: vi.fn((val) => val),
    }

    const result = await tagHandler(context)

    expect(context.error).toHaveBeenCalledWith({
      code: 'AI_ERROR',
      message: 'RPC failed',
    })
    expect(result).toEqual({
      code: 'AI_ERROR',
      message: 'RPC failed',
    })
  })
})
