import { motion } from 'framer-motion'
import type { RuleExercise } from '@/engine/exercises'
import { parseInline, parseNotes, ruleSpeech, splitAside, type Inline, type NoteRule } from '@/content/notes'
import { Button } from '@/components/Button'
import { SpeakButton } from './SpeakButton'

/**
 * Rappel de cours affiché avant la pratique, à la découverte d'une leçon.
 *
 * C'est le seul écran de la session qui soit purement à lire : tout l'enjeu
 * est qu'il se parcoure d'un coup d'œil plutôt qu'il ne se subisse. D'où trois
 * partis pris :
 *
 *   - une seule idée par bloc, et une taille de texte par niveau de lecture
 *     (l'attaque, les règles, les exemples, les pièges) ;
 *   - les règles rassemblées dans un panneau teinté, séparées par des filets,
 *     pour qu'on voie d'emblée combien il y en a ;
 *   - l'anglais toujours dans la même graisse sombre, le français en gris :
 *     l'œil apprend vite à sauter de l'un à l'autre.
 *
 * Le texte source reste du texte brut ; `parseNotes` en reconstitue la
 * structure. Voir content/README.md pour les conventions d'écriture.
 */

const TONES = {
  grammar: {
    accent: 'bg-violet',
    eyebrow: 'text-violet',
    panel: 'bg-violet/8',
    marker: 'bg-violet',
    label: 'text-violet-deep',
    button: 'violet',
  },
  conjugation: {
    accent: 'bg-sky',
    eyebrow: 'text-sky-deep',
    panel: 'bg-sky/8',
    marker: 'bg-sky',
    label: 'text-sky-deep',
    button: 'sky',
  },
} as const

export function RuleNote({ exercise, onNext }: { exercise: RuleExercise; onNext: () => void }) {
  const blocks = parseNotes(exercise.notes)
  const tone = TONES[exercise.topic]

  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className={`text-xs font-black uppercase tracking-widest ${tone.eyebrow}`}>Rappel</p>

      {/* Un rappel se lit de haut en bas : le texte commence tout de suite,
          sous le fil d'Ariane, plutôt que de flotter au centre de l'écran.
          La colonne se borne en largeur, au-delà les lignes deviennent trop
          longues pour être suivies confortablement. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="card-3d flex w-full max-w-lg flex-col gap-4 self-center px-6 py-6"
      >
        <header className="flex flex-col gap-3">
          <span className={`h-1.5 w-10 rounded-full ${tone.accent}`} />
          <h2 className="text-2xl leading-tight font-black text-balance">{exercise.title}</h2>
        </header>

        {blocks.map((block, index) => {
          if (block.kind === 'paragraph') {
            // La première prose est l'attaque du rappel : plus grande et plus
            // sombre, elle porte l'idée que tout le reste vient détailler.
            const lead = index === 0
            return (
              <p
                key={index}
                className={
                  lead
                    ? 'text-[0.975rem] leading-relaxed font-semibold text-ink'
                    : 'text-sm leading-relaxed text-ink-soft'
                }
              >
                <Rich text={block.text} />
              </p>
            )
          }

          if (block.kind === 'warning') {
            return (
              <p
                key={index}
                className="flex gap-2.5 rounded-2xl border-2 border-amber/40 bg-amber/10 px-4 py-3 text-sm leading-relaxed text-ink"
              >
                <span aria-hidden className="text-base leading-tight">
                  ⚠
                </span>
                <span>
                  <Rich text={block.text} />
                </span>
              </p>
            )
          }

          return (
            <ul key={index} className={`flex flex-col rounded-2xl ${tone.panel} px-4 py-1`}>
              {block.rules.map((rule, position) => (
                <li
                  key={position}
                  className="flex gap-3 border-b border-ink/8 py-3 last:border-b-0"
                >
                  <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${tone.marker}`} />
                  <RuleBody rule={rule} labelClass={tone.label} />
                </li>
              ))}
            </ul>
          )
        })}
      </motion.div>

      <div className="mt-auto w-full max-w-lg self-center pt-4">
        <Button block tone={tone.button} onClick={onNext}>
          C'est parti
        </Button>
      </div>
    </div>
  )
}

function RuleBody({ rule, labelClass }: { rule: NoteRule; labelClass: string }) {
  const { main, aside } = splitAside(rule.body)
  // Rien à entendre pour une règle purement française : le bouton ne s'affiche
  // que là où une forme anglaise est sûrement identifiable (voir ruleSpeech).
  const spoken = ruleSpeech(rule)

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sm leading-snug text-ink">
        {/* Le deux-points d'origine sert de séparateur : il se lit aussi bien
            derrière une catégorie (« Une syllabe : ») que derrière une règle
            entière (« must n'a pas de passé propre : »). */}
        {rule.label && (
          <span className={`font-black ${labelClass}`}>
            <Rich text={rule.label} /> :{' '}
          </span>
        )}
        <span className="font-semibold">
          <Rich text={main} />
        </span>
        {aside && (
          <span className="font-normal text-ink-faint">
            {' ('}
            <Rich text={aside} />
            {')'}
          </span>
        )}
      </p>
      {(rule.example || spoken) && (
        <div className="flex items-start gap-2">
          {rule.example && (
            <p className="min-w-0 flex-1 text-sm leading-snug font-bold text-ink-soft italic">
              <Rich text={rule.example} />
            </p>
          )}
          {/* Pas `auto`, à la différence des autres boutons d'écoute de la
              session : un rappel porte plusieurs règles à la fois, chacune
              avec la sienne. Toutes lancées au montage se couperaient les
              unes les autres — `speak()` interrompt la lecture en cours
              avant de parler — et l'apprenant n'entendrait que des bribes. */}
          {spoken && <SpeakButton text={spoken} size={16} className="shrink-0 !p-1.5" />}
        </div>
      )}
    </div>
  )
}

/**
 * Rend le texte enrichi d'un rappel.
 *
 * `form` — une forme anglaise citée — reçoit un fond très léger plutôt qu'une
 * couleur : dans un paragraphe déjà teinté, la couleur se perdrait, alors que
 * le liseré tient sur tous les fonds de l'écran. Le rembourrage est donné en
 * `em` et reste serré, pour que la ponctuation qui suit ne paraisse pas
 * décrochée du mot.
 */
export function Rich({ text }: { text: string }) {
  return <Spans spans={parseInline(text)} />
}

function Spans({ spans }: { spans: Inline[] }) {
  return (
    <>
      {spans.map((span, index) => {
        switch (span.kind) {
          case 'strong':
            return (
              <strong key={index} className="font-black text-ink">
                <Spans spans={span.children} />
              </strong>
            )
          case 'em':
            return (
              <em key={index} className="italic">
                <Spans spans={span.children} />
              </em>
            )
          case 'underline':
            return (
              <span key={index} className="font-bold underline decoration-2 underline-offset-[3px]">
                <Spans spans={span.children} />
              </span>
            )
          case 'form':
            // Une forme courte ne doit pas se couper en deux (« depend / on »).
            // Une phrase citée entière, si : l'empêcher de se replier la ferait
            // déborder de la colonne, sous le bouton d'écoute.
            return (
              <span
                key={index}
                lang="en"
                className={`rounded bg-ink/6 px-[0.15em] font-bold text-ink ${
                  span.text.length <= 24 ? 'whitespace-nowrap' : ''
                }`}
              >
                {span.text}
              </span>
            )
          default:
            return <span key={index}>{span.text}</span>
        }
      })}
    </>
  )
}
