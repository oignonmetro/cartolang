import { z } from 'zod'

/**
 * Format d'écriture des cours (fichiers YAML de `content/`).
 *
 * Ce schéma est la seule source de vérité : `tools/content/build.ts` le
 * consomme pour valider puis compiler les YAML en JSON, et l'application
 * en dérive ses types. Toute évolution du format se fait ici.
 */

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'identifiant en minuscules, chiffres et tirets')

/** Une phrase d'exemple. `text` est dans la langue apprise. */
export const exampleSchema = z.object({
  text: z.string().min(1),
  translation: z.string().min(1),
})

/**
 * Une entrée de vocabulaire.
 *
 * - `term`        : le mot dans la langue apprise (anglais pour le cours fr-en)
 * - `translation` : sa traduction dans la langue de l'apprenant
 * - `alt`         : autres réponses acceptées à la saisie clavier
 * - `example`     : phrase d'exemple ; si elle contient `term`, un exercice
 *                   à trou est généré automatiquement
 * - `audio`       : réservé pour une version ultérieure, ignoré pour l'instant
 */
export const vocabSchema = z.object({
  id: slug,
  term: z.string().min(1),
  translation: z.string().min(1),
  alt: z.array(z.string().min(1)).default([]),
  hint: z.string().optional(),
  pos: z
    .enum(['nom', 'verbe', 'adjectif', 'adverbe', 'expression', 'pronom', 'préposition', 'nombre'])
    .optional(),
  example: exampleSchema.optional(),
  audio: z.string().optional(),
})

export const lessonSchema = z.object({
  id: slug,
  title: z.string().min(1),
  /** Vocabulaire introduit par la leçon. */
  vocab: z.array(vocabSchema).min(1),
})

export const unitSchema = z.object({
  id: slug,
  title: z.string().min(1),
  /** Sous-titre affiché sur la bannière du chemin. */
  subtitle: z.string().optional(),
  /** Nom d'icône rendu sur la bannière (voir `src/components/UnitIcon.tsx`). */
  icon: z.string().default('book'),
  /** Teinte de l'unité sur le chemin. */
  color: z.enum(['teal', 'violet', 'coral', 'amber', 'sky']).default('teal'),
  lessons: z.array(lessonSchema).min(1),
})

export const sectionSchema = z.object({
  id: slug,
  title: z.string().min(1),
  units: z.array(unitSchema).min(1),
})

export const courseSchema = z.object({
  id: slug,
  /** Nom affiché de la langue apprise. */
  name: z.string().min(1),
  /** Code BCP-47 de la langue apprise. */
  learning: z.string().min(2),
  /** Code BCP-47 de la langue de l'apprenant (interface). */
  known: z.string().min(2),
  /** Emoji ou drapeau affiché dans l'en-tête. */
  flag: z.string().default('🇬🇧'),
  /** Incrémentée à chaque publication de contenu ; sert aux mises à jour. */
  version: z.number().int().positive(),
  sections: z.array(sectionSchema).min(1),
})

export type Example = z.infer<typeof exampleSchema>
export type Vocab = z.infer<typeof vocabSchema>
export type Lesson = z.infer<typeof lessonSchema>
export type Unit = z.infer<typeof unitSchema>
export type Section = z.infer<typeof sectionSchema>
export type Course = z.infer<typeof courseSchema>

export type UnitColor = Unit['color']

/** Entrée du manifeste listant les cours disponibles. */
export const manifestEntrySchema = z.object({
  id: slug,
  name: z.string(),
  learning: z.string(),
  known: z.string(),
  flag: z.string(),
  version: z.number().int().positive(),
  file: z.string(),
  vocabCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
})

export const manifestSchema = z.object({
  generatedAt: z.string(),
  courses: z.array(manifestEntrySchema),
})

export type ManifestEntry = z.infer<typeof manifestEntrySchema>
export type Manifest = z.infer<typeof manifestSchema>
