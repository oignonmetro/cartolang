import { beforeEach, describe, expect, it, vi } from 'vitest'

const isNativePlatform = vi.fn(() => true)
const downloadAndInstall = vi.fn(async (_options: { url: string }) => {})
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatform() },
  registerPlugin: () => ({ downloadAndInstall: (options: { url: string }) => downloadAndInstall(options) }),
}))

const getInfo = vi.fn(async () => ({ build: '1' }))
vi.mock('@capacitor/app', () => ({ App: { getInfo: () => getInfo() } }))

const { checkForAppUpdate, downloadAndInstallUpdate } = await import('./appUpdate')

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 500 })
}

beforeEach(() => {
  isNativePlatform.mockReturnValue(true)
  getInfo.mockResolvedValue({ build: '1' })
})

describe('vérification de la version de l’app', () => {
  it('ne fait aucun appel réseau hors de l’app native', async () => {
    isNativePlatform.mockReturnValue(false)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(await checkForAppUpdate()).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('signale une mise à jour quand le versionCode distant dépasse celui installé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ versionCode: 2, versionName: '1.1', url: 'https://example.com/app.apk' })),
    )

    const update = await checkForAppUpdate()

    expect(update).toEqual({ versionCode: 2, versionName: '1.1', url: 'https://example.com/app.apk' })
  })

  it('ne signale rien quand la version distante est déjà installée', async () => {
    getInfo.mockResolvedValue({ build: '2' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ versionCode: 2, versionName: '1.1', url: 'https://example.com/app.apk' })),
    )

    expect(await checkForAppUpdate()).toBeNull()
  })

  it('ne signale rien quand la version distante est plus ancienne', async () => {
    getInfo.mockResolvedValue({ build: '5' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ versionCode: 2, versionName: '1.1', url: 'https://example.com/app.apk' })),
    )

    expect(await checkForAppUpdate()).toBeNull()
  })

  it('reste silencieux si l’origine est injoignable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )

    await expect(checkForAppUpdate()).resolves.toBeNull()
  })

  it('reste silencieux si le fichier distant est invalide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ oops: true })))

    await expect(checkForAppUpdate()).resolves.toBeNull()
  })

  it('reste silencieux si la réponse HTTP est en échec', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ versionCode: 2, versionName: '1.1', url: 'https://example.com/app.apk' }, false)),
    )

    await expect(checkForAppUpdate()).resolves.toBeNull()
  })
})

describe('téléchargement et installation de l’app', () => {
  it('signale le démarrage quand le plugin natif aboutit', async () => {
    downloadAndInstall.mockResolvedValueOnce(undefined)

    await expect(downloadAndInstallUpdate('https://example.com/app.apk')).resolves.toBe('started')
    expect(downloadAndInstall).toHaveBeenCalledWith({ url: 'https://example.com/app.apk' })
  })

  it('signale qu’une autorisation est requise', async () => {
    downloadAndInstall.mockRejectedValueOnce(new Error('permission-denied'))

    await expect(downloadAndInstallUpdate('https://example.com/app.apk')).resolves.toBe('permission-required')
  })

  it('signale un échec pour toute autre erreur', async () => {
    downloadAndInstall.mockRejectedValueOnce(new Error('Le téléchargement a échoué.'))

    await expect(downloadAndInstallUpdate('https://example.com/app.apk')).resolves.toBe('failed')
  })
})
