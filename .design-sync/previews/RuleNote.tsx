import { RuleNote } from 'cartolang'

/**
 * Rappel de grammaire : attaque en prose, puis un panneau de règles (avec
 * étiquette, corps, exemple en retrait), puis un piège signalé par « ! ».
 * Couvre en un seul rendu les trois briques que `parseNotes` sait produire.
 */
export function Grammar() {
  return (
    <RuleNote
      exercise={{
        kind: 'rule',
        id: 'rule:third-conditional',
        title: 'La troisième conditionnelle',
        notes: `On l'utilise pour regretter un choix passé : ce qui aurait pu se
passer, mais ne s'est pas passé.

— If + plus-que-parfait, … would have + participe passé : structure de base.
    If I had known, I would have called you.
— Une seule syllabe : ne double pas l'auxiliaire.
    She would have won (jamais « would have have »).

! Ne confondez pas avec la deuxième conditionnelle, qui parle d'un présent
imaginaire, pas d'un passé révolu.`,
        topic: 'grammar',
      }}
      onNext={() => {}}
    />
  )
}

/**
 * Rappel de conjugaison : teinte sky, une seule règle sans exemple. Montre
 * que le panneau reste lisible même réduit à une entrée.
 */
export function Conjugation() {
  return (
    <RuleNote
      exercise={{
        kind: 'rule',
        id: 'rule:modal-must',
        title: 'Le modal must au passé',
        notes: `« must » n'a pas de forme au passé qui lui soit propre.

— Obligation passée : on le remplace par « had to ».
— Déduction passée : on garde « must », suivi de « have » + participe passé.

! « must have » exprime une déduction (« il a dû partir »), jamais une
obligation passée.`,
        topic: 'conjugation',
      }}
      onNext={() => {}}
    />
  )
}
