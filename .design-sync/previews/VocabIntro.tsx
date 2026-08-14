import { VocabIntro } from 'cartolang'

const cogent = {
  id: 'c1-cogent',
  term: 'cogent',
  translation: 'convaincant',
  alt: ['probant'],
  pos: 'adjectif',
  hint: "Un argument qui s'impose par sa logique, pas par la force de conviction de celui qui le porte.",
  example: {
    text: 'She made a cogent case for restructuring the team.',
    translation: 'Elle a présenté un argumentaire convaincant en faveur de la réorganisation.',
  },
}

/**
 * Présentation d'un mot nouveau : terme, catégorie, traduction, phrase d'exemple.
 *
 * La racine du composant est `flex-1` : dans l'app elle se déploie dans la
 * colonne pleine hauteur de SessionScreen. Isolée sans ancêtre haut, elle
 * n'a rien où grandir et disparaît — d'où la hauteur explicite ici, qui
 * reproduit l'espace réel plutôt que d'ajouter une contrainte artificielle.
 */
export function Default() {
  return (
    <div style={{ height: 560 }} className="flex flex-col">
      <VocabIntro exercise={{ kind: 'intro', id: 'intro:cogent', vocab: cogent }} onRate={() => {}} />
    </div>
  )
}
