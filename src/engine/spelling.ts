/**
 * Orthographes équivalentes de la langue apprise.
 *
 * Certaines langues s'apprennent dans une transcription sans norme : le
 * darija s'écrit en lettres latines et en chiffres (« arabizi »), et le même
 * mot circule sous plusieurs graphies — `chokran`, `choukran`, `shukran`.
 * Compter faux un apprenant qui tape l'une plutôt que l'autre le punirait
 * d'une convention, pas d'une ignorance. On ramène donc les deux côtés de la
 * comparaison à une forme canonique avant de les confronter.
 *
 * Le repli ne s'applique qu'à ce qui est tapé dans la langue apprise — jamais
 * au français — et n'existe que pour les langues qui en déclarent un : pour
 * l'anglais ou le russe, l'orthographe est elle-même ce qu'on enseigne.
 *
 * L'état est global, comme la voix (voir `setSpokenLanguage`) : il suit le
 * cours actif, et le fil qu'on aurait sinon à passer à chaque comparaison
 * traverserait tous les composants d'exercice pour une seule ligne.
 */

type Fold = (value: string) => string

const identity: Fold = (value) => value

/**
 * Darija en transcription latine. Ce qui varie d'un scripteur à l'autre, et
 * seulement cela :
 *
 *   - `sh` et `ch` notent tous deux ش ;
 *   - `ou`, `u` et `o` notent la même voyelle ;
 *   - `q` et `9` notent tous deux ق ;
 *   - le `e` muet (schwa) s'écrit ou non : `mezyan` / `mzyan` ;
 *   - `i` devant une voyelle s'écrit aussi `y` : `dial` / `dyal` ;
 *   - une consonne doublée (gémination) s'écrit souvent simple : `bezzaf` /
 *     `bzaf` — mais seulement à l'intérieur du mot. En tête, le redoublement
 *     est l'article assimilé (`ddar`, la maison, contre `dar`, une maison) :
 *     c'est une différence de sens, et la grammaire l'enseigne.
 *
 * Les chiffres `3` (ع) et `7` (ح) restent distincts de `a` et `h` : ce sont
 * d'autres sons, et les confondre change le mot.
 */
export const foldDarija: Fold = (value) =>
  value
    .replace(/sh/g, 'ch')
    .replace(/ou/g, 'u')
    .replace(/o/g, 'u')
    .replace(/q/g, '9')
    .replace(/e/g, '')
    .replace(/i(?=[aiu])/g, 'y')
    .replace(/(?<=\S)(.)\1+/g, '$1')

const FOLDS: Record<string, Fold> = {
  ary: foldDarija,
}

let active: Fold = identity

/** Appelé au chargement d'un cours (voir `CourseProvider`). */
export function setSpellingLanguage(learning: string): void {
  active = FOLDS[learning] ?? identity
}

/** Forme canonique d'une saisie déjà normalisée (casse, accents, ponctuation). */
export function foldSpelling(value: string): string {
  return active(value)
}
