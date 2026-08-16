import { ConjugationChoice } from 'cartolang'

const work = {
  verb: 'to work',
  translation: 'travailler',
  tense: 'present perfect continu',
  note: 'Souvent accompagné de « for » (durée) ou « since » (point de départ).',
  forms: [
    { id: 'c2-work-ppc-1', person: 'I / you / we / they', answer: 'have been working', alt: ["'ve been working"] },
    { id: 'c2-work-ppc-3', person: 'he / she / it', answer: 'has been working', alt: ["'s been working"] },
  ],
}

const OPTIONS = ['has been working', 'have been waiting', 'have been working']

/*
 * L'échelon qui manquait sous la production. La piste réclamait d'écrire
 * « has been working » de mémoire dès la découverte du tableau, alors que la
 * seule chose apprenable à ce stade est la différence entre les formes — et
 * c'est elle que les leurres opposent, en prenant d'abord les autres personnes
 * du même verbe.
 *
 * Les trois options ci-dessous varient sur deux colonnes (l'auxiliaire, le
 * verbe) : les deux se soulignent, la colonne commune (« been ») reste en
 * clair — sans repère, retrouver ce qui change forcerait à relire les trois
 * cases mot à mot plutôt que de comparer d'un coup d'œil.
 */
function stage(cue: 'verb' | 'translation') {
  return (
    <div style={{ height: 620 }} className="flex flex-col">
      <ConjugationChoice
        exercise={{
          kind: 'conjugation-choice',
          id: `cchoice:${cue}:c2-work-ppc-3`,
          verb: work,
          form: work.forms[1],
          cue,
          options: OPTIONS,
        }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/** L'infinitif anglais est donné : il ne reste qu'à accorder. */
export function DepuisLAnglais() {
  return stage('verb')
}

/**
 * L'infinitif français seul. Il faut retrouver le verbe anglais avant de le
 * conjuguer — le rappel réellement utile pour parler, personne ne partant en
 * conversation d'un infinitif anglais déjà trouvé. L'anglais disparaît donc de
 * l'énoncé : l'afficher en petit sous le français donnerait la moitié de la
 * réponse.
 */
export function DepuisLeFrancais() {
  return stage('translation')
}
