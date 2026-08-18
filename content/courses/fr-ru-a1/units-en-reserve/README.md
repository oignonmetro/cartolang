# Unités en réserve

Ces unités ne sont **pas compilées** : le compilateur ne lit que `units/`, et
`course.yaml` ne les référence pas. Elles restent ici, versionnées et
relisibles, en attendant d'être réintégrées.

| Fichier  | Contenu                        |
| -------- | ------------------------------ |
| `u6.yaml` | Salutations et présentations   |
| `u7.yaml` | Nombres, jours et moments      |
| `u8.yaml` | Manger et boire                |

## Pourquoi elles attendent

Elles ont été écrites pour la version « parcours » du cours, où les unités
s'enchaînaient : arrivé à `u6`, on avait forcément vu les trente-trois lettres.
Le cours est passé en accès libre (`layout: library`), et cette garantie
tombe — rien n'empêcherait d'ouvrir « Manger et boire » avant d'avoir lu une
seule lettre cyrillique, et l'apprenant s'y heurterait à des mots qu'il ne peut
pas déchiffrer.

Leur vocabulaire reste bon ; c'est leur place dans la bibliothèque qui doit
être tranchée. Deux pistes, à instruire le moment venu :

- les fondre dans l'unité d'alphabet, en prolongement des leçons de mots, au
  prix d'une unité encore plus longue ;
- en faire des unités à part entière, une fois qu'un mécanisme de
  prérequis entre unités existera.

## Les remettre en service

Déplacer le fichier dans `units/`, l'ajouter à la piste voulue dans
`course.yaml`, incrémenter `version`, puis `npm run content:check` — le
contrôle d'alphabet (voir `tools/content/difficulty.ts`) dira aussitôt si un
mot emploie une lettre que le parcours n'a pas encore enseignée.
