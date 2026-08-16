import type { ReactNode } from 'react'

/**
 * La liste d'options d'un QCM, quel que soit ce qu'on y choisit : un mot, une
 * phrase entière, une forme conjuguée.
 *
 * Elle est partagée parce que le retour visuel est le même partout et doit le
 * rester — la bonne case se colore en vert, celle qu'on avait prise en rouge,
 * les autres s'effacent. Trois écrans qui redécrivent chacun ces trois états
 * finissent par ne plus les décrire pareil.
 *
 * Elle ne juge de rien : c'est `isCorrect` qui dit ce qui est juste, parce que
 * la comparaison n'est pas la même selon la piste (un mot de vocabulaire
 * s'accepte sans son article, une forme grammaticale non — voir
 * `normalizeAnswer` et `normalizeForm`).
 */
export function OptionList({
  options,
  picked,
  isCorrect,
  onPick,
  lang,
  size = 'normal',
  renderOption,
}: {
  options: string[]
  /** L'option choisie, ou `null` tant que rien n'est joué. */
  picked: string | null
  isCorrect: (option: string) => boolean
  onPick: (option: string) => void
  lang?: string
  /** `long` pour des phrases entières : le texte respire, le numéro s'aligne en haut. */
  size?: 'normal' | 'long'
  /**
   * Rendu personnalisé d'une option, par défaut le texte brut. Sert à mettre
   * en évidence ce qui distingue les cases entre elles — quand les options ne
   * diffèrent que par quelques mots noyés dans une phrase identique, il faut
   * les relire en entier pour repérer l'écart ; le souligner évite cette
   * chasse et ramène l'attention sur ce qui teste réellement.
   */
  renderOption?: (option: string) => ReactNode
}) {
  const checked = picked !== null

  return (
    <div className="flex flex-col gap-3">
      {options.map((option, index) => {
        const isPicked = picked === option
        const isAnswer = checked && isCorrect(option)
        const tone = !checked
          ? 'border-line bg-paper'
          : isAnswer
            ? 'border-success bg-success/15 text-success'
            : isPicked
              ? 'border-error bg-error/15 text-error'
              : 'border-line bg-paper text-ink-faint'

        return (
          <button
            key={option}
            type="button"
            lang={lang}
            disabled={checked}
            onClick={() => onPick(option)}
            className={`flex gap-3 rounded-2xl border-2 px-4 py-3 text-left font-bold transition-colors disabled:opacity-100 ${
              size === 'long' ? 'items-start text-sm leading-snug' : 'items-center'
            } ${tone}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-current text-xs ${
                // Sur une phrase de deux lignes, un numéro centré verticalement
                // flotte au milieu du texte : il se cale sur la première ligne.
                size === 'long' ? 'mt-px' : ''
              }`}
            >
              {index + 1}
            </span>
            <span className="break-words">{renderOption ? renderOption(option) : option}</span>
          </button>
        )
      })}
    </div>
  )
}
