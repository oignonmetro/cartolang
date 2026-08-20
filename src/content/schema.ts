import { z } from 'zod'

/**
 * Format d'écriture des cours (fichiers YAML de `content/`).
 *
 * Ce schéma est la seule source de vérité : `tools/content/build.ts` le
 * consomme pour valider puis compiler les YAML en JSON, et l'application
 * en dérive ses types. Toute évolution du format se fait ici.
 *
 * Deux agencements coexistent :
 *
 *   `path`    — parcours linéaire, une leçon débloque la suivante (cours débutant) ;
 *   `library` — pistes thématiques (vocabulaire, grammaire, conjugaison) que
 *               l'apprenant parcourt librement, dans l'ordre qu'il veut.
 *
 * Et trois natures de contenu, qui n'ont ni les mêmes données ni les mêmes
 * exercices : `vocab`, `grammar`, `conjugation`.
 */

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant en minuscules, chiffres et tirets')

/** Marqueur de trou dans une phrase de grammaire. */
export const GAP = '___'

/** Une phrase d'exemple. `text` est dans la langue apprise. */
export const exampleSchema = z.object({
  text: z.string().min(1),
  translation: z.string().min(1),
})

/**
 * Une entrée de vocabulaire.
 *
 * - `term`        : le mot dans la langue apprise (anglais pour les cours fr-*)
 * - `translation` : sa traduction dans la langue de l'apprenant
 * - `alt`         : autres réponses acceptées à la saisie clavier
 * - `example`     : phrase d'exemple ; si elle contient `term`, un exercice
 *                   à trou est généré automatiquement
 * - `gap`         : portion exacte à masquer dans l'exemple, quand la forme
 *                   conjuguée ne se déduit pas du terme (« fell through »)
 * - `audio`       : réservé pour une version ultérieure, ignoré pour l'instant
 */
export const vocabSchema = z.object({
  id: slug,
  term: z.string().min(1),
  translation: z.string().min(1),
  alt: z.array(z.string().min(1)).default([]),
  hint: z.string().optional(),
  pos: z
    .enum([
      'nom',
      'verbe',
      'adjectif',
      'adverbe',
      'expression',
      'pronom',
      'préposition',
      'conjonction',
      'nombre',
      // Une carte peut porter une lettre plutôt qu'un mot : c'est ainsi que le
      // cours de russe enseigne l'alphabet, avec les mêmes exercices que le
      // vocabulaire (flashcard, association, QCM).
      'lettre',
    ])
    .optional(),
  example: exampleSchema.optional(),
  gap: z.string().min(1).optional(),
  audio: z.string().optional(),
})

/**
 * Un point de grammaire à pratiquer : une phrase trouée, sa réponse, et de
 * quoi comprendre l'erreur. `sentence` doit contenir le marqueur `___`.
 *
 * `options` est facultatif : quand il est fourni, l'exercice se joue en
 * choisissant parmi les formes proposées ; sinon la réponse est saisie.
 */
export const grammarPointSchema = z.object({
  id: slug,
  sentence: z.string().min(1),
  answer: z.string().min(1),
  alt: z.array(z.string().min(1)).default([]),
  options: z.array(z.string().min(1)).default([]),
  translation: z.string().optional(),
  explanation: z.string().optional(),
})

/** Une forme conjuguée : la personne et la forme attendue. */
export const conjugationFormSchema = z.object({
  id: slug,
  person: z.string().min(1),
  answer: z.string().min(1),
  alt: z.array(z.string().min(1)).default([]),
})

/** Un verbe à un temps donné, avec ses formes. */
export const conjugationVerbSchema = z.object({
  verb: z.string().min(1),
  translation: z.string().optional(),
  tense: z.string().min(1),
  note: z.string().optional(),
  forms: z.array(conjugationFormSchema).min(2),
})

export const lessonKindSchema = z.enum(['vocab', 'grammar', 'conjugation'])
export type LessonKind = z.infer<typeof lessonKindSchema>

const lessonBase = {
  id: slug,
  title: z.string().min(1),
  /** Rappel de cours affiché avant la pratique. */
  notes: z.string().optional(),
  /**
   * Point d'entrée du parcours d'unité (agencement `library`) : ce nœud peut
   * être rejoint directement, sans repasser par ce qui précède — voir
   * `UnitPathScreen`. Réservé aux leçons qui ouvrent une section cohérente de
   * l'unité ; l'alphabet russe en est l'exemple type, une leçon de lettres
   * par groupe. Son libellé sur le chemin se déduit du contenu de la leçon
   * (voir `checkpointLabel` dans `unitPath.ts`), pas d'un champ séparé à
   * tenir à jour.
   */
  checkpoint: z.boolean().default(false),
}

export const vocabLessonSchema = z.object({
  ...lessonBase,
  kind: z.literal('vocab'),
  vocab: z.array(vocabSchema).min(1),
})

export const grammarLessonSchema = z.object({
  ...lessonBase,
  kind: z.literal('grammar'),
  points: z.array(grammarPointSchema).min(1),
})

export const conjugationLessonSchema = z.object({
  ...lessonBase,
  kind: z.literal('conjugation'),
  verbs: z.array(conjugationVerbSchema).min(1),
})

export const lessonSchema = z.discriminatedUnion('kind', [
  vocabLessonSchema,
  grammarLessonSchema,
  conjugationLessonSchema,
])

export const unitColorSchema = z.enum(['teal', 'violet', 'coral', 'amber', 'sky'])

export const unitSchema = z.object({
  id: slug,
  title: z.string().min(1),
  /** Sous-titre affiché sur la carte ou la bannière. */
  subtitle: z.string().optional(),
  /** Nom d'icône rendu à côté du titre (voir `src/components/icons.tsx`). */
  icon: z.string().default('book'),
  color: unitColorSchema.default('teal'),
  /** Repère de difficulté affiché tel quel, par exemple « B2.1 ». */
  level: z.string().optional(),
  /** Nature du contenu ; héritée de la piste par le compilateur. */
  kind: lessonKindSchema,
  lessons: z.array(lessonSchema).min(1),
})

/**
 * Une piste de l'agencement `library` : un onglet de l'écran d'accueil.
 *
 * `units` peut être vide : c'est ce qui permet de publier le squelette d'un
 * niveau (ses trois pistes, ses couleurs) avant d'y avoir écrit la moindre
 * leçon. L'écran affiche alors un état « à venir » pour cette piste.
 */
export const trackSchema = z.object({
  id: slug,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  kind: lessonKindSchema,
  color: unitColorSchema.default('teal'),
  icon: z.string().default('book'),
  units: z.array(unitSchema),
})

export const sectionSchema = z.object({
  id: slug,
  title: z.string().min(1),
  units: z.array(unitSchema).min(1),
})

const courseBase = {
  id: slug,
  /** Nom affiché de la langue apprise. */
  name: z.string().min(1),
  /** Code BCP-47 de la langue apprise. */
  learning: z.string().min(2),
  /** Code BCP-47 de la langue de l'apprenant (interface). */
  known: z.string().min(2),
  /** Emoji ou drapeau affiché dans l'en-tête. */
  flag: z.string().default('🇬🇧'),
  /** Repère de niveau affiché à la sélection, par exemple « B2 ». */
  level: z.string().optional(),
  /** Phrase de présentation affichée à la sélection du cours. */
  tagline: z.string().optional(),
  /**
   * `archived` retire le cours de la sélection sans le supprimer : le contenu
   * reste versionné, validé par la CI, et réactivable en changeant ce champ.
   */
  status: z.enum(['available', 'archived']).default('available'),
  /**
   * Cours proposé en premier tant que l'apprenant n'a rien choisi. Sans ce
   * marqueur explicite, le premier cours disponible par ordre alphabétique
   * de dossier ferait office de défaut — imprévisible, et faux dès qu'un
   * cours plus riche existe à côté d'un squelette vide. Au plus un cours
   * devrait le porter ; s'il y en a plusieurs, le premier rencontré gagne.
   */
  default: z.boolean().default(false),
  /** Incrémentée à chaque publication de contenu ; sert aux mises à jour. */
  version: z.number().int().positive(),
}

export const pathCourseSchema = z.object({
  ...courseBase,
  layout: z.literal('path'),
  sections: z.array(sectionSchema).min(1),
})

export const libraryCourseSchema = z.object({
  ...courseBase,
  layout: z.literal('library'),
  tracks: z.array(trackSchema).min(1),
})

export const courseSchema = z.discriminatedUnion('layout', [pathCourseSchema, libraryCourseSchema])

export type Example = z.infer<typeof exampleSchema>
export type Vocab = z.infer<typeof vocabSchema>
export type GrammarPoint = z.infer<typeof grammarPointSchema>
export type ConjugationForm = z.infer<typeof conjugationFormSchema>
export type ConjugationVerb = z.infer<typeof conjugationVerbSchema>
export type VocabLesson = z.infer<typeof vocabLessonSchema>
export type GrammarLesson = z.infer<typeof grammarLessonSchema>
export type ConjugationLesson = z.infer<typeof conjugationLessonSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type Unit = z.infer<typeof unitSchema>
export type Track = z.infer<typeof trackSchema>
export type Section = z.infer<typeof sectionSchema>
export type PathCourse = z.infer<typeof pathCourseSchema>
export type LibraryCourse = z.infer<typeof libraryCourseSchema>
export type Course = z.infer<typeof courseSchema>

export type UnitColor = z.infer<typeof unitColorSchema>

/**
 * Un élément pratiquable, quelle que soit sa nature. C'est l'unité que la
 * révision espacée suit : chaque `id` correspond à une carte.
 */
export type PracticeItem =
  | { kind: 'vocab'; id: string; vocab: Vocab }
  | { kind: 'grammar'; id: string; point: GrammarPoint }
  | { kind: 'conjugation'; id: string; form: ConjugationForm; verb: ConjugationVerb }

/** Entrée du manifeste listant les cours disponibles. */
export const manifestEntrySchema = z.object({
  id: slug,
  name: z.string(),
  learning: z.string(),
  known: z.string(),
  flag: z.string(),
  level: z.string().optional(),
  tagline: z.string().optional(),
  layout: z.enum(['path', 'library']),
  status: z.enum(['available', 'archived']),
  // `.default(false)`, pas requis : un manifeste mis en cache avant
  // l'ajout de ce champ (voir `contentCache.ts`) doit rester lisible.
  default: z.boolean().default(false),
  version: z.number().int().positive(),
  file: z.string(),
  itemCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
})

export const manifestSchema = z.object({
  generatedAt: z.string(),
  courses: z.array(manifestEntrySchema),
})

export type ManifestEntry = z.infer<typeof manifestEntrySchema>
export type Manifest = z.infer<typeof manifestSchema>
