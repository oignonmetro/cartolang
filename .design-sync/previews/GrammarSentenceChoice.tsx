import { GrammarSentenceChoice } from 'cartolang'

const mixed = {
  id: 'g1-mixed-1',
  sentence: 'If I had taken that job, I ___ in Berlin now.',
  answer: 'would be',
  alt: [],
  options: ['would be', 'would have been', 'will be', 'had been'],
  translation: "Si j'avais accepté ce poste, je serais à Berlin maintenant.",
  explanation: 'Hypothèse passée (had taken) mais conséquence dans le présent : would + base verbale.',
}

/*
 * L'échelon de reconnaissance de la piste grammaire. Il n'existait pas : la
 * leçon posait une phrase à trou par point, toujours la même, si bien que six
 * points faisaient six exercices d'un seul gabarit.
 *
 * La phrase trouée se traite souvent par élimination mécanique — quatre formes
 * côte à côte, on prend celle qui sonne juste dans un espace vide. Ici les
 * phrases sont écrites en entier et il faut les lire : c'est à la lecture que
 * le décalage de temps s'entend, ce que la leçon enseigne.
 */
function stage(options: string[]) {
  return (
    <div style={{ height: 620 }} className="flex flex-col">
      <GrammarSentenceChoice
        exercise={{ kind: 'grammar-choice', id: `sentence:${mixed.id}`, point: mixed, options }}
        onAnswer={() => {}}
      />
    </div>
  )
}

/**
 * Le français donne le sens visé. Sans lui, plusieurs de ces phrases seraient
 * défendables et l'exercice porterait sur la devinette, plus sur la règle.
 */
export function Posee() {
  return stage([
    'If I had taken that job, I will be in Berlin now.',
    'If I had taken that job, I would be in Berlin now.',
    'If I had taken that job, I would have been in Berlin now.',
  ])
}
