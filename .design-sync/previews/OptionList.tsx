import { OptionList } from 'cartolang'

/*
 * La liste d'options partagée par les trois QCM de l'application : le mot de
 * vocabulaire, la phrase de grammaire entière, la forme conjuguée. Elle est
 * partagée parce que le retour visuel doit rester le même partout — trois
 * écrans qui redécrivent chacun « juste / faux / écarté » finissent par ne
 * plus les décrire pareil.
 *
 * Les états ci-dessous sont figés par la prop `picked` : le composant ne juge
 * de rien lui-même, c'est `isCorrect` qui dit ce qui est juste.
 */
const FORMES = ['has been working', 'have been waiting', 'have been working']

/** Rien de joué : toutes les cases se valent. */
export function Intacte() {
  return (
    <OptionList
      options={FORMES}
      picked={null}
      isCorrect={(option) => option === 'has been working'}
      onPick={() => {}}
      lang="en"
    />
  )
}

/** La bonne case a été prise : elle seule se colore. */
export function Reussie() {
  return (
    <OptionList
      options={FORMES}
      picked="has been working"
      isCorrect={(option) => option === 'has been working'}
      onPick={() => {}}
      lang="en"
    />
  )
}

/**
 * Une case fautive a été prise : elle passe au rouge, la bonne se montre en
 * vert, et les autres s'effacent plutôt que de disparaître — ce qui a été
 * écarté fait partie de la correction.
 */
export function Manquee() {
  return (
    <OptionList
      options={FORMES}
      picked="have been working"
      isCorrect={(option) => option === 'has been working'}
      onPick={() => {}}
      lang="en"
    />
  )
}

/**
 * `size="long"` pour des phrases entières : le texte respire sur deux lignes
 * et le numéro se cale en haut, au lieu de flotter au milieu du paragraphe.
 */
export function PhrasesEntieres() {
  return (
    <OptionList
      options={[
        'If I had taken that job, I will be in Berlin now.',
        'If I had taken that job, I would be in Berlin now.',
        'If I had taken that job, I would have been in Berlin now.',
      ]}
      picked={null}
      isCorrect={(option) => option.includes('would be')}
      onPick={() => {}}
      lang="en"
      size="long"
    />
  )
}
