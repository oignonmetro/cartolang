import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { ChevronLeftIcon, RefreshIcon } from '@/components/icons'

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
 * compte d'oublis accompagné d'une flèche circulaire : le mot est *revenu*
 * tant de fois, ce qui est un cycle et non une faute. Le même chiffre sans
 * l'icône se lit comme un reproche.
 *
 * L'ordre porte la gravité — le plus tenace en tête — ce qui dispense d'un
 * second codage (barre, couleur graduée) qui répéterait la même chose en plus
 * bruyant. Et le bouton reste teal, la couleur de toutes les actions de
 * l'app : le corail dit la difficulté, il ne doit pas dire aussi la sortie.
 */

interface HardWord {
  id: string
  term: string
  translation: string
  /** Nombre d'oublis depuis la phase de révision (`lapses` côté moteur). */
  forgotten: number
  /** Depuis combien de temps le mot résiste, en jours. */
  stuckFor: number
}

/*
 * Des mots-outils, pas du vocabulaire démonstratif : ce sont eux qui résistent
 * réellement à un francophone, parce qu'ils n'ont pas d'équivalent net en
 * français et se ressemblent entre eux.
 */
const WORDS: HardWord[] = [
  { id: 'actually', term: 'actually', translation: 'en fait', forgotten: 7, stuckFor: 58 },
  { id: 'though', term: 'though', translation: 'pourtant, bien que', forgotten: 6, stuckFor: 41 },
  { id: 'eventually', term: 'eventually', translation: 'finalement', forgotten: 6, stuckFor: 33 },
  { id: 'although', term: 'although', translation: 'bien que', forgotten: 5, stuckFor: 22 },
  { id: 'to-afford', term: 'to afford', translation: 'avoir les moyens de', forgotten: 5, stuckFor: 17 },
  { id: 'worth', term: 'worth', translation: 'qui vaut la peine', forgotten: 4, stuckFor: 12 },
  { id: 'since', term: 'since', translation: 'depuis, puisque', forgotten: 4, stuckFor: 9 },
  { id: 'comfortable', term: 'comfortable', translation: 'confortable', forgotten: 3, stuckFor: 6 },
]

/** « depuis 3 semaines » se lit mieux que « depuis 21 jours ». */
function since(days: number): string {
  if (days < 14) return `${days} jours`
  const weeks = Math.round(days / 7)
  if (weeks < 9) return `${weeks} semaines`
  return `${Math.round(days / 30)} mois`
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

      <main className="flex flex-1 flex-col gap-5 px-4 pt-5 pb-10">
        {/* L'accroche, sans cadre : elle n'est pas cliquable, et lui donner la
            carte des lignes en dessous laisserait croire le contraire. */}
        <section className="flex items-start gap-3">
          <Mascot mood="reassuring" size={72} className="-mt-2 shrink-0" />
          <div className="flex-1 pt-1">
            <h2 className="text-lg leading-tight font-black text-balance">Vos mots coriaces</h2>
            <p className="mt-1 text-sm leading-snug text-ink-soft">
              Tout le monde en a. Ce sont même ceux sur lesquels votre temps rapporte le plus —
              les autres, vous les savez déjà.
            </p>
          </div>
        </section>

        <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">
          Les plus tenaces d'abord
        </p>

        <ul className="flex flex-col gap-3">
          {WORDS.map((word) => (
            <li key={word.id}>
              {/* Terme et traduction sur la même ligne de base : l'œil les
                  apparie d'un coup, comme dans une entrée de dictionnaire, et
                  la liste entière tient dans un écran au lieu d'un et demi. */}
              <article className="card-3d flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
                    <span className="text-base font-extrabold break-words" lang="en">
                      {word.term}
                    </span>
                    <span className="text-sm text-ink-soft">{word.translation}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">Résiste depuis {since(word.stuckFor)}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral/15 px-3 py-1 text-xs font-extrabold text-coral-deep">
                  <RefreshIcon size={13} />
                  {word.forgotten} oublis
                </span>
              </article>
            </li>
          ))}
        </ul>

        {/* Le bouton après la liste, et non avant : on décide de s'y mettre une
            fois qu'on a vu que le tas est petit. La durée juste en dessous
            lève le vrai frein — « ça va me prendre combien de temps ». */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <Button block onClick={() => navigate('/revision')}>
            Travailler ces {WORDS.length} mots
          </Button>
          <span className="text-xs text-ink-faint">Une séance de 5 minutes suffit.</span>
        </div>
      </main>
    </div>
  )
}
