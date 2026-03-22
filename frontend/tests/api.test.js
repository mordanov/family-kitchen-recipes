import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadBrowserScript } from './helpers/loadBrowserScript'

function jsonResponse(body, status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    json: vi.fn().mockResolvedValue(body),
  }
}

function binaryResponse(blob, status = 200, contentType = 'application/pdf') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null),
    },
    blob: vi.fn().mockResolvedValue(blob),
    json: vi.fn(),
  }
}

describe('API client', () => {
  beforeEach(() => {
    loadBrowserScript('../../public/js/api.js', 'API')
  })

  it('adds the bearer token header and parses json responses', async () => {
    localStorage.setItem('token', 'jwt-token')
    fetch.mockResolvedValue(jsonResponse({ username: 'chef' }))

    const result = await window.API.me()

    expect(result).toEqual({ username: 'chef' })
    expect(fetch).toHaveBeenCalledTimes(1)

    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/me')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer jwt-token')
  })

  it('clears the token and reloads the page on unauthorized responses', async () => {
    localStorage.setItem('token', 'expired-token')
    fetch.mockResolvedValue(jsonResponse({ detail: 'expired' }, 401))

    const result = await window.API.me()

    expect(result).toBeUndefined()
    expect(localStorage.getItem('token')).toBeNull()
    expect(location.reload).toHaveBeenCalledTimes(1)
  })

  it('encodes recipe search strings in listRecipes requests', async () => {
    fetch.mockResolvedValue(jsonResponse([]))

    await window.API.listRecipes('сыр & суп')

    const [url] = fetch.mock.calls[0]
    expect(url).toBe('/api/recipes/?search=%D1%81%D1%8B%D1%80%20%26%20%D1%81%D1%83%D0%BF')
  })

  it('downloads recipe material with bearer token', async () => {
    localStorage.setItem('token', 'jwt-token')
    const pdfBlob = new Blob(['%PDF-test'], { type: 'application/pdf' })
    fetch.mockResolvedValue(binaryResponse(pdfBlob))

    const result = await window.API.downloadRecipeMaterial(42)

    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('application/pdf')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/recipes/42/additional-material/download')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer jwt-token')
  })
})

