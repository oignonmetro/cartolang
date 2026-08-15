import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { ChevronLeftIcon } from '@/components/icons'

/**
 * Les mots qui résistent.
 *
 * PROTOTYPE DE CONCEPTION — les données sont écrites en dur. Le moteur sait
 * déjà les produire (`lapses` sur chaque carte, `solidity()` dans
 * `unitPath.ts`), il reste à brancher.
 *
 * Le parti pris tient en une phrase : ce n'est pas une liste d'échecs, c'est
 * la liste des mots où le temps passé rapporte le plus. Tout en découle —
 * l'accroche qui banalise, le corail plutôt que le rouge d'erreur, et le
 * compte de rechutes écrit sobrement plutôt que brandi. L'ordre suffit à dire
 * la gravité : le plus tenace est en tête, et il n'y a donc pas besoin d'un
 * second codage (barre, couleur graduée) qui répéterait la même chose en plus
 * bruyant.
 */

interface HardWord {
  id: string
  term: string
  translation: string
  /** Nombre de rechutes depuis la phase de révision. */
  lapses: number
  /** Depuis combien de temps le mot résiste, en jours. */
  stuckFor: number
}

const WORDS: HardWord[] = [
  { id: 'b2-to-overwhelm', term: 'to overwhelm', translation: 'submerger', lapses: 7, stuckFor: 24 },
  { id: 'b2-reluctant', term: 'reluctant', translation: 'réticent', lapses: 6, stuckFor: 19 },
  { id: 'b2-to-acknowledge', term: 'to acknowledge', translation: 'reconnaître', lapses: 5, stuckFor: 31 },
  { id: 'b2-cogent', term: 'cogent', translation: 'convaincant', lapses: 5, stuckFor: 12 },
  { id: 'b2-to-postpone', term: 'to postpone', translation: 'reporter', lapses: 4, stuckFor: 9 },
  { id: 'b2-thorough', term: 'thorough', translation: 'minutieux', lapses: 4, stuckFor: 16 },
  { id: 'b2-to-argue', term: 'to argue', translation: 'soutenir', lapses: 3, stuckFor: 7 },
  { id: 'b2-liability', term: 'liability', translation: 'responsabilité', lapses: 3, stuckFor: 5 },
]

/** « depuis 3 semaines » se lit mieux que « depuis 21 jours ». */
function since(days: number): string {
  if (days < 14) return `depuis ${days} jours`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `depuis ${weeks} semaines`
  return `depuis ${Math.round(days / 30)} mois`
}

export function HardWordsScreen() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-cream/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            aria-label="Retour"
            className="rounded-full p-2 text-ink-faint hover:text-ink"
          >
            <ChevronLeftIcon size={24} />
          </button>
          <h1 className="flex-1 text-base leading-tight font-black">Mots difficiles</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 px-4 pt-5 pb-16">
        {/* L'accroche, sans cadre : elle n'est pas cliquable, et lui donner la
            carte des lignes en dessous laisserait croire le contraire. */}
        <section className="flex items-start gap-3">
          <Mascot mood="reassuring" size={72} className="-mt-2 shrink-0" />
          <div className="flex-1 pt-1">
            <h2 className="text-lg leading-tight font-black text-balance">
              Huit mots vous résistent
            </h2>
            <p className="mt-1 text-sm leading-snug text-ink-soft">
              Tout le monde en a. Ce sont même les mots sur lesquels votre temps rapporte le plus :
              les autres, vous les savez déjà.
            </p>
          </div>
        </section>

        {/* Teal, comme toutes les actions de l'app, et non corail comme le
            reste de l'écran : le corail dit la difficulté, il ne doit pas dire
            aussi la sortie. Les confondre teintait l'issue de la couleur du
            problème, et un grand aplat saturé en haut d'écran contredisait
            l'accroche qui vient juste de dire que tout allait bien. */}
        <Button block onClick={() => navigate('/revision')}>
          Travailler ces {WORDS.length} mots
        </Button>

        {/* L'ordre porte la gravité : le plus tenace en tête. Le dire évite
            que ce soit une convention à deviner. */}
        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          Les plus tenaces d'abord
        </p>

        <ul className="flex flex-col gap-3">
          {WORDS.map((word) => (
            <li key={word.id}>
              <article className="card-3d flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-tight font-extrabold break-words" lang="en">
                    {word.term}
                  </p>
                  <p className="text-sm leading-snug text-ink-soft">{word.translation}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">Vous butez dessus {since(word.stuckFor)}.</p>
                </div>
                {/* Le compte est une information, pas un reproche : même pastille
                    pour tous, la magnitude se lit déjà dans le chiffre et dans
                    la place qu'occupe la ligne dans la liste. */}
                <span className="shrink-0 rounded-full bg-coral/15 px-3 py-1 text-xs font-extrabold text-coral-deep">
                  {word.lapses} oublis
                </span>
              </article>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
