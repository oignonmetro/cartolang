import { useAppUpdate } from '@/content/useAppUpdate'
import { Button } from './Button'
import { RefreshIcon } from './icons'

/**
 * Case « mise à jour disponible » du profil : le pendant du bandeau
 * (`AppUpdateBanner.tsx`) pour qui a tapé « Plus tard ». Le bandeau se
 * masque une fois ignoré, mais la mise à jour reste réelle tant qu'elle
 * n'est pas installée — cette case ne tient donc pas compte du « Plus
 * tard » et reste visible jusqu'à l'installation effective.
 */
export function AppUpdateCard() {
  const { update, status, download } = useAppUpdate()

  if (!update) return null

  return (
    <section className="card-3d flex flex-col gap-2 border-teal/40 bg-teal/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <RefreshIcon size={20} className="text-teal" />
        <p className="flex-1 text-sm font-bold">Version {update.versionName} disponible.</p>
        <Button tone="teal" onClick={() => void download()} disabled={status === 'downloading'} className="text-xs">
          {status === 'downloading' ? 'Patientez…' : 'Télécharger'}
        </Button>
      </div>
      {status === 'permission-required' && (
        <p className="text-xs text-ink-soft">
          Autorisez Cartolang à installer des applications dans les réglages qui viennent de s'ouvrir, puis retapez
          sur « Télécharger ».
        </p>
      )}
      {status === 'failed' && (
        <p className="text-xs text-ink-soft">Le téléchargement a échoué. Vérifiez votre connexion et réessayez.</p>
      )}
    </section>
  )
}
