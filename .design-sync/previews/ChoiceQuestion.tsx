import { ChoiceQuestion } from 'cartolang'

const postpone = {
  id: 'b2-to-postpone',
  term: 'to postpone',
  translation: 'reporter',
  alt: ['remettre à plus tard'],
  pos: 'verbe',
  hint: 'Décaler dans le temps, sans annuler ni renoncer.',
  example: {
    text: 'They postponed the meeting until next week.',
    translation: 'Ils ont reporté la réunion à la semaine prochaine.',
  },
}

/*
 * Un même mot, cinq énoncés. C'est ce qui a remplacé la question unique
 * (« voici le français, trouvez l'anglais ») que la leçon reposait à chaque
 * fois : vingt-trois exercices se ramenaient à quatre gabarits. Chaque cellule
 * ci-dessous montre un énoncé, tous sur le même mot pour que la comparaison
 * porte sur la question et non sur le vocabulaire.
 */
const OPTIONS_FR = ['reporter', 'annuler', 'accélérer']
// Les trois infinitifs partagent leur « to » : c'est le cas où le
// soulignage (voir highlightDiffWords) a quelque chose à montrer, alors que
// OPTIONS_FR — trois mots sans rapport — reste en clair, comme la plupart
// des QCM de vocabulaire.
const OPTIONS_EN = ['to postpone', 'to cancel', 'to rush']

function stage(cue: 'term' | 'translation' | 'hint' | 'sentence' | 'audio', options: string[]) {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <ChoiceQuestion
        exercise={{ kind: 'choice', id: `choice:${cue}:${postpone.id}`, vocab: postpone, cue, options }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/** Le mot anglais est montré, on choisit son sens. */
export function CueTerm() {
  return stage('term', OPTIONS_FR)
}

/** Le mot français est montré, on choisit la forme anglaise. */
export function CueTranslation() {
  return stage('translation', OPTIONS_EN)
}

/**
 * La note d'usage tient lieu d'énoncé : le français ne sert plus de béquille,
 * c'est le sens seul qui doit rappeler la forme.
 */
export function CueHint() {
  return stage('hint', OPTIONS_EN)
}

/**
 * La phrase d'exemple traduite : le mot se retrouve par le contexte plutôt
 * que par une paire isolée. Disponible pour tous les mots du cours.
 */
export function CueSentence() {
  return stage('sentence', OPTIONS_EN)
}

/**
 * Le mot prononcé, jamais écrit — sinon il ne resterait rien à reconnaître.
 * L'anglais ne s'écrit pas comme il se dit : sans cet énoncé, la moitié du
 * mot restait non apprise.
 */
export function CueAudio() {
  return stage('audio', OPTIONS_EN)
}
