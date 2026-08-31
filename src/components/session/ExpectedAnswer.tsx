/**
 * Point où la réponse tapée cesse de correspondre à la bonne réponse,
 * caractère par caractère depuis le début.
 *
 * Un simple préfixe commun, pas un vrai diff : la plupart des erreurs sur une
 * forme russe sont une terminaison manquante ou fautive (casse, accord,
 * conjugaison), pas une lettre isolée au milieu du mot. Souligner depuis le
 * premier désaccord jusqu'à la fin montre exactement ce cas-là d'un coup
 * d'œil ; un vrai diff, qui chercherait aussi les points de recoupement après
 * la divergence, produirait un passage souligné-non souligné-souligné bien
 * plus dur à lire pour un gain qui ne sert quasiment jamais.
 */
function divergenceAt(typed: string, expected: string): number {
  const a = typed.trim().toLowerCase()
  const b = expected.toLowerCase()
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

/**
 * La bonne réponse, en grand et avec la partie absente de ce que l'apprenant
 * vient de taper soulignée — pour qu'il repère son erreur sans avoir à
 * comparer lettre par lettre une forme parfois longue. `typed` vide (QCM,
 * banque de mots jamais essayée) souligne la réponse entière : rien n'a
 * encore été comparé, tout reste à découvrir.
 */
export function ExpectedAnswer({ typed, expected }: { typed: string; expected: string }) {
  const at = divergenceAt(typed, expected)
  return (
    <span className="text-2xl font-black">
      {expected.slice(0, at)}
      {at < expected.length && (
        <span className="underline decoration-2 underline-offset-4">{expected.slice(at)}</span>
      )}
    </span>
  )
}
