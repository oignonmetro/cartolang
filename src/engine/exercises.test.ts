import { describe, expect, it } from 'vitest'
import type { ConjugationLesson, GrammarLesson, PracticeItem, Vocab, VocabLesson } from '@/content/schema'
import {
  buildLessonSession,
  buildPracticeSession,
  buildReviewSession,
  choiceAnswer,
  fillGap,
  isAnswerCorrect,
  isPresentation,
  itemIdsOf,
  lessonProgress,
  matchesAnswer,
  normalizeAnswer,
  splitGap,
  type Exercise,
} from './exercises'
import { seedFrom } from './rng'
import { createCard, review, type CardState } from './srs'

/** Emballe une liste de mots dans une leçon de vocabulaire. */
function lessonOf(id: string, vocab: Vocab[]): VocabLesson {
  return { kind: 'vocab', id, title: id, vocab }
}

const T0 = Date.UTC(2026, 0, 1)

function word(id: string, term: string, translation: string, example?: string, alt: string[] = []): Vocab {
  return {
    id,
    term,
    translation,
    alt,
    example: example ? { text: example, translation: '…' } : undefined,
  }
}

const LESSON: Vocab[] = [
  word('hello', 'hello', 'bonjour', 'Hello, my name is Anna.'),
  word('thank-you', 'thank you', 'merci', 'Thank you for your help.'),
  word('sorry', 'sorry', 'désolé', 'Sorry, I am late.', ['pardon']),
  word('please', 'please', "s'il vous plaît", 'A coffee, please.'),
  word('yes', 'yes', 'oui', 'Yes, I understand.'),
  word('no', 'no', 'non', 'No, thank you.'),
]

function kinds(session: Exercise[]): string[] {
  return session.map((exercise) => exercise.kind)
}

describe('session de leçon', () => {
  it('présente et note chaque mot en un seul écran', () => {
    // La présentation montre déjà tout (terme, traduction, exemple) : une
    // flashcard séparée juste après ne testerait rien de plus, elle ne ferait
    // que répéter ce qui vient d'être lu. L'auto-évaluation est donc portée
    // par l'écran de présentation lui-même.
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0)
    const intros = session.filter((exercise) => exercise.kind === 'intro')
    expect(intros).toHaveLength(LESSON.length)
    for (const intro of intros) {
      expect(itemIdsOf(intro)).toEqual([intro.vocab.id])
    }
  })

  it('alterne présentations et exercices au lieu de tout présenter d’un coup', () => {
    // Six mots donnent deux blocs de trois : on découvre la moitié des mots,
    // on les travaille, puis on découvre l'autre moitié. Présenter les six
    // d'affilée demanderait de tout retenir avant le premier exercice.
    const session = kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 0))
    const introIndexes = session
      .map((kind, index) => (kind === 'intro' ? index : -1))
      .filter((index) => index !== -1)
    expect(introIndexes).toHaveLength(LESSON.length)

    // Des exercices s'intercalent : les présentations ne sont pas toutes
    // groupées en tête de session.
    const firstNonIntro = session.findIndex((kind) => kind !== 'intro')
    expect(introIndexes.some((index) => index > firstNonIntro)).toBe(true)
    expect(session.slice(0, firstNonIntro)).toHaveLength(Math.ceil(LESSON.length / 2))
  })

  it('présente chaque mot avant de le faire travailler', () => {
    // La contrainte que le découpage en blocs doit préserver : aucun exercice
    // ne peut porter sur un mot qui n'a pas encore été présenté.
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      const introduced = new Set<string>()
      for (const exercise of session) {
        if (exercise.kind === 'intro') {
          introduced.add(exercise.vocab.id)
          continue
        }
        for (const id of itemIdsOf(exercise)) expect(introduced.has(id)).toBe(true)
      }
    }
  })

  it('répartit les mots entre les blocs plutôt que d’entasser le reste', () => {
    // La taille des blocs vise quatre, mais le reste se répartit : cinq mots
    // font 3 + 2, six font 3 + 3, sept font 4 + 3. Sans ça, un reliquat trop
    // maigre était recollé au bloc précédent et l'on retombait sur un bloc
    // unique — toutes les présentations d'affilée.
    const introRuns = (count: number): number[] => {
      const words = Array.from({ length: count }, (_, i) => word(`w${i}`, `word${i}`, `mot${i}`, `Example ${i}.`))
      const session = kinds(buildLessonSession(lessonOf('u1-l1', words), 0))
      const runs: number[] = []
      let run = 0
      for (const kind of session) {
        if (kind === 'intro') run += 1
        else if (run > 0) {
          runs.push(run)
          run = 0
        }
      }
      if (run > 0) runs.push(run)
      return runs
    }

    expect(introRuns(5)).toEqual([3, 2])
    expect(introRuns(6)).toEqual([3, 3])
    expect(introRuns(7)).toEqual([4, 3])
    expect(introRuns(8)).toEqual([4, 4])
  })

  it('présente les chiffres dans l’ordre de l’auteur, jamais mélangés', () => {
    // Mélanger « un, deux, trois » retire tout ce que l'ordre enseigne : un
    // chiffre appris avant les précédents ne dit rien tant qu'on ne sait pas
    // encore où il tombe dans la suite. Ne vaut que pour une leçon entièrement
    // faite de chiffres — le reste continue de mélanger.
    const numbers: Vocab[] = ['un', 'deux', 'trois', 'quatre', 'cinq', 'six'].map((translation, i) => ({
      ...word(`n${i}`, `w${i}`, translation),
      pos: 'nombre',
    }))
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u7-l1', numbers), 0, seed)
      const order = session.filter((exercise) => exercise.kind === 'intro').map((exercise) => exercise.vocab.id)
      expect(order).toEqual(numbers.map((n) => n.id))
    }
  })

  it('mélange toujours une leçon qui ne porte pas que des chiffres', () => {
    const mixed: Vocab[] = [
      { ...word('n0', 'w0', 'un'), pos: 'nombre' },
      { ...word('n1', 'w1', 'deux'), pos: 'nombre' },
      { ...word('n2', 'w2', 'trois'), pos: 'nombre' },
      { ...word('w3', 'w3', 'nombre'), pos: 'nom' },
    ]
    const orders = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u4-l1', mixed), 0, seed)
      const order = session.filter((exercise) => exercise.kind === 'intro').map((exercise) => exercise.vocab.id)
      orders.add(order.join())
    }
    expect(orders.size).toBeGreaterThan(1)
  })

  it('ne compte pas la découverte d’un mot dans le score de la leçon', () => {
    // Déclarer nouveau un mot jamais vu n'est pas une faute : compté comme
    // telle, huit mots annoncés nouveaux suffisaient à faire échouer la
    // leçon d'un apprenant honnête.
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0)
    expect(session.filter((exercise) => exercise.kind === 'intro').every(isPresentation)).toBe(true)
  })

  it('propose des manches d’association, des QCM puis des phrases à trou après la présentation', () => {
    const session = kinds(buildLessonSession(lessonOf('u1-l1', LESSON), 0))
    expect(session).toContain('match')
    expect(session).toContain('choice')
    expect(session).toContain('cloze')
  })

  it('propose un thème vers la langue apprise après avoir fait reconnaître le mot', () => {
    // Sans lui, la leçon ne teste que la reconnaissance — associer, QCM,
    // phrase à trou en banque — jamais écrire le mot de mémoire. Pour une
    // écriture non latine (l'alphabet russe), lire sans jamais tracer laisse
    // la moitié du travail non fait.
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      const themes = session.filter((exercise) => exercise.kind === 'type')
      expect(themes.length).toBeGreaterThan(0)
      expect(themes.every((exercise) => exercise.direction === 'to-learning')).toBe(true)

      // Jamais sur un mot que ce même bloc n'a pas déjà fait reconnaître :
      // écrire de mémoire un mot tout juste découvert ne testerait rien.
      const recognized = new Set(
        session.filter((exercise) => exercise.kind === 'choice' || exercise.kind === 'cloze').flatMap(itemIdsOf),
      )
      for (const theme of themes) expect(recognized.has(theme.vocab.id)).toBe(true)
    }
  })

  it('propose aussi le thème en dictée quand l’appareil sait parler', () => {
    // Sans elle, le mot à écrire est toujours donné par son sens — jamais
    // par son seul son, la moitié de ce que l'oreille doit apprendre à
    // transcrire dans un alphabet nouveau.
    const cues = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      for (const exercise of session.filter((e) => e.kind === 'type')) cues.add(exercise.cue)
    }
    expect(cues).toEqual(new Set(['text', 'audio']))
  })

  it('ne propose jamais de dictée sans synthèse vocale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, false)
      expect(session.filter((e) => e.kind === 'type').every((e) => e.cue === 'text')).toBe(true)
    }
  })

  it('propose aussi des manches d’association à l’audio quand l’appareil sait parler', () => {
    // Sans elle, l'association ne teste jamais l'oreille : toujours la
    // lecture, quel que soit le nombre de manches sur toute une leçon.
    const cues = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      for (const exercise of session.filter((e) => e.kind === 'match')) cues.add(exercise.cue)
    }
    expect(cues).toEqual(new Set(['text', 'audio']))
  })

  it('ne propose jamais de manche d’association à l’audio sans synthèse vocale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, false)
      expect(session.filter((e) => e.kind === 'match').every((e) => e.cue === 'text')).toBe(true)
    }
  })

  it('ouvre la session par un rappel quand la leçon en porte un', () => {
    // Le seul endroit où le vocabulaire a besoin d'expliquer une règle plutôt
    // que de la laisser se déduire des mots : l'accord numéral-nom du russe,
    // par exemple, change la forme du nom compté sans qu'aucun mot pris
    // isolément ne le montre.
    const withNotes: VocabLesson = { kind: 'vocab', id: 'u1-l1', title: 'Les chiffres', vocab: LESSON, notes: 'Le nom compté change de forme selon le nombre.' }
    const [first] = buildLessonSession(withNotes, 0)
    expect(first).toMatchObject({ kind: 'rule', topic: 'vocab', title: 'Les chiffres' })
    expect(isPresentation(first!)).toBe(true)
  })

  it('ne rajoute rien sans rappel à afficher', () => {
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0)
    expect(session.some((exercise) => exercise.kind === 'rule')).toBe(false)
  })

  it('propose toujours une banque de mots pour les phrases à trou', () => {
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0).filter((e) => e.kind === 'cloze')
    expect(session.length).toBeGreaterThan(0)
    // La banque doit contenir une case qui vaut réellement la réponse, au
    // sens où l'écran la valide — pas seulement le terme de dictionnaire.
    expect(
      session.every(
        (e) => e.bank !== null && e.bank.some((w) => normalizeAnswer(w) === normalizeAnswer(e.sentence.match)),
      ),
    ).toBe(true)
  })

  it('remplit la banque d’une phrase à trou même tôt dans une petite leçon', () => {
    // Régression : la banque piochait ses leurres dans les seuls mots déjà
    // présentés (le bloc en cours), pas dans toute la leçon — un bloc de
    // trois mots ne pouvait alors rendre que trois cases sur quatre, une
    // grille à deux colonnes avec une rangée à moitié vide.
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed).filter((e) => e.kind === 'cloze')
      expect(session.length).toBeGreaterThan(0)
      for (const exercise of session) {
        expect(exercise.bank).toHaveLength(4)
      }
    }
  })

  it('propose au moins deux options distinctes à chaque QCM, dont la bonne réponse', () => {
    // Toutes graines et tous énoncés confondus : la réponse attendue dépend de
    // l'énoncé (le sens quand on montre le mot, la forme sinon), et une option
    // qui vaudrait la réponse offrirait deux bonnes cases.
    for (const seed of [1, 2, 3, 4, 5]) {
      const choices = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true).filter(
        (e) => e.kind === 'choice',
      )
      expect(choices.length).toBeGreaterThan(0)
      for (const exercise of choices) {
        const answer = choiceAnswer(exercise.vocab, exercise.cue)
        expect(exercise.options.length).toBeGreaterThanOrEqual(2)
        expect(new Set(exercise.options.map(normalizeAnswer)).size).toBe(exercise.options.length)
        expect(exercise.options.some((option) => normalizeAnswer(option) === normalizeAnswer(answer))).toBe(true)
      }
    }
  })

  it('propose la forme fléchie, pas l’infinitif, quand le mot est irrégulier', () => {
    // Régression : la banque offrait « to fall out » alors que la phrase
    // attend « fell out », ce qui rendait l'exercice impossible à réussir.
    const irregular: Vocab[] = [
      { ...word('fall-out', 'to fall out', 'se brouiller', 'The brothers fell out over money.'), gap: 'fell out' },
      { ...word('book', 'to book', 'réserver', 'We booked a room online.'), gap: 'booked' },
      word('landlord', 'landlord', 'propriétaire', 'The landlord raised the rent.'),
      word('rent', 'rent', 'loyer', 'The rent is due today.'),
      word('cosy', 'cosy', 'douillet', 'The room is small but cosy.'),
    ]
    const guided = buildLessonSession(lessonOf('u2-l1', irregular), 0).filter((e) => e.kind === 'cloze')
    expect(guided.length).toBeGreaterThan(0)
    for (const exercise of guided) {
      expect(exercise.bank).not.toBeNull()
      expect(exercise.bank!.some((w) => normalizeAnswer(w) === normalizeAnswer(exercise.sentence.match))).toBe(true)
      // et une seule case doit être correcte
      const correct = exercise.bank!.filter((w) => normalizeAnswer(w) === normalizeAnswer(exercise.sentence.match))
      expect(correct).toHaveLength(1)
    }
  })

  it('est déterministe à graine égale, différente d’une tentative à l’autre', () => {
    expect(buildLessonSession(lessonOf('u1-l1', LESSON), 0, 1)).toEqual(buildLessonSession(lessonOf('u1-l1', LESSON), 0, 1))
    expect(buildLessonSession(lessonOf('u1-l1', LESSON), 0, 1)).not.toEqual(buildLessonSession(lessonOf('u1-l1', LESSON), 0, 2))
  })

  it('n’enchaîne pas deux exercices sur le même mot', () => {
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0)
    for (let i = 1; i < session.length; i++) {
      const previous = new Set(itemIdsOf(session[i - 1]))
      const repeated = itemIdsOf(session[i]).filter((id) => previous.has(id))
      // Une manche d'association peut reprendre un mot déjà vu ; les autres non.
      if (session[i].kind !== 'match' && session[i - 1].kind !== 'match') {
        expect(repeated).toHaveLength(0)
      }
    }
  })

  it('ignore les mots sans phrase d’exemple exploitable', () => {
    const vocab = [
      word('a', 'apple', 'pomme'),
      word('b', 'bread', 'pain', 'Une phrase sans le mot attendu.'),
      word('c', 'cheese', 'fromage', 'This cheese is good.'),
      word('d', 'milk', 'lait', 'There is no milk left.'),
    ]
    const clozes = buildLessonSession(lessonOf('x', vocab), 0).filter((e) => e.kind === 'cloze')
    expect(clozes.every((e) => e.vocab.id === 'c' || e.vocab.id === 'd')).toBe(true)
  })

  it('n’ajoute pas de manche d’association sous quatre mots', () => {
    const tiny = LESSON.slice(0, 3)
    expect(kinds(buildLessonSession(lessonOf('x', tiny), 0))).not.toContain('match')
  })

  it('ne réintroduit pas un mot qui a déjà une carte de révision', () => {
    // Régression : rejouer une leçon déjà sue rouvrait sa présentation en
    // entier, huit écrans « nouveau mot » avant le premier vrai exercice —
    // exactement ce que `lessonDifficulty` était censé éviter avant que le
    // vocabulaire ne passe aux blocs.
    const known: Record<string, CardState> = Object.fromEntries(
      LESSON.map((v) => [v.id, createCard(v.id, T0)]),
    )
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, undefined, known)
    expect(kinds(session)).not.toContain('intro')
    // Le reste du bloc continue de faire travailler ces mots.
    expect(kinds(session)).toContain('match')
    expect(kinds(session)).toContain('choice')
    expect(kinds(session)).toContain('cloze')
  })

  it('ne présente que les mots réellement nouveaux d’une leçon en partie connue', () => {
    const known: Record<string, CardState> = { [LESSON[0].id]: createCard(LESSON[0].id, T0) }
    const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, undefined, known)
    const introduced = session.filter((e) => e.kind === 'intro').map((e) => e.vocab.id)
    expect(introduced).not.toContain(LESSON[0].id)
    expect(introduced).toHaveLength(LESSON.length - 1)
  })

  it('répartit une grande leçon sur plusieurs blocs plutôt que de tout présenter d’un coup', () => {
    const big = [...LESSON, ...LESSON.map((w) => ({ ...w, id: `${w.id}-2` }))] // 12 mots
    const session = kinds(buildLessonSession(lessonOf('big', big), 0))
    expect(session.filter((kind) => kind === 'intro')).toHaveLength(big.length)
    // Au moins deux groupes d'intros séparés par d'autres exercices.
    let groups = 0
    for (let i = 0; i < session.length; i++) {
      if (session[i] === 'intro' && session[i - 1] !== 'intro') groups++
    }
    expect(groups).toBeGreaterThan(1)
  })
})

describe('taille des manches d’association', () => {
  const BIG_LESSON: Vocab[] = Array.from({ length: 10 }, (_, i) =>
    word(`w${i}`, `word${i}`, `mot${i}`, `Example ${i}.`),
  )

  const matchSizes = (lesson: Vocab[], seed: number, rank = 0, id = 'big') =>
    buildLessonSession(lessonOf(id, lesson), 0, seed, {}, true, rank)
      .filter((e) => e.kind === 'match')
      .map((e) => e.pairs.length)

  it('monte d’une paire à la fois et ne redescend jamais', () => {
    // Régression : la taille était tirée au sort à chaque manche, si bien que
    // la difficulté sautait dans les deux sens d'une grille à l'autre.
    for (let seed = 0; seed < 20; seed++) {
      const sizes = matchSizes(BIG_LESSON, seed)
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]! - sizes[i - 1]!).toBeGreaterThanOrEqual(0)
        expect(sizes[i]! - sizes[i - 1]!).toBeLessThanOrEqual(1)
      }
    }
  })

  it('repart du plancher quand une nouvelle section commence', () => {
    // C'est le rang zéro qui porte la remise à zéro : la leçon qui ouvre une
    // section enseigne des lettres neuves, et relier six paires d'un coup
    // dessus punirait le passage au lieu de l'accompagner.
    for (let seed = 0; seed < 20; seed++) {
      expect(matchSizes(BIG_LESSON, seed, 0)[0]).toBe(4)
    }
  })

  it('grandit à mesure qu’on avance dans la section', () => {
    // Comparer deux sessions terme à terme supposerait qu'elles restent
    // alignées manche pour manche d'un rang à l'autre — or la taille tirée
    // influence le nombre de tentatives avant une composition inédite (voir
    // `matchRounds`), donc le flux aléatoire diverge dès la première manche
    // où le bassin dépasse le plancher. La moyenne sur toute la session
    // n'a pas ce défaut : un rang plus élevé part plus haut et atteint le
    // plafond plus tôt, ce qui la tire vers le haut quelle que soit l'issue
    // de chaque tentative individuelle.
    const mean = (sizes: number[]) => sizes.reduce((sum, size) => sum + size, 0) / sizes.length
    let total = 0
    for (let seed = 0; seed < 20; seed++) {
      const early = mean(matchSizes(BIG_LESSON, seed, 0))
      const late = mean(matchSizes(BIG_LESSON, seed, 2))
      expect(late).toBeGreaterThanOrEqual(early)
      total += late - early
    }
    expect(total).toBeGreaterThan(0)
  })

  it('atteint six paires au fil d’une section de deux leçons', () => {
    // Les sections de « Lire le russe » n'ont que deux leçons de six mots :
    // sans la rampe qui continue de manche en manche à l'intérieur d'une
    // leçon, le rang seul plafonnerait à cinq et la grille de six ne se
    // verrait jamais.
    const section = new Set<number>()
    for (let seed = 0; seed < 20; seed++) {
      for (const rank of [0, 1]) for (const size of matchSizes(LESSON, seed, rank, `l${rank}`)) section.add(size)
    }
    expect(section.has(6)).toBe(true)
  })

  it('ne dépasse jamais six paires', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const size of matchSizes(BIG_LESSON, seed, 5)) expect(size).toBeLessThanOrEqual(6)
    }
  })

  it('reste au minimum quand le bassin n’offre rien de plus', () => {
    const sizes = matchSizes(LESSON.slice(0, 4), 1, 3, 'u1-l1')
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.every((size) => size === 4)).toBe(true)
  })
})

describe('variété des exercices de vocabulaire', () => {
  /** Signature d'un exercice ciblé : le mot ET la question posée. */
  function signature(exercise: Exercise): string {
    const cue = 'cue' in exercise ? `:${exercise.cue}` : ''
    return `${exercise.kind}${cue}:${itemIdsOf(exercise).join()}`
  }

  const targeted = (session: Exercise[]) => session.filter((e) => e.kind === 'choice' || e.kind === 'cloze')

  it('ne pose jamais deux fois la même question sur le même mot', () => {
    // Régression : la phrase à trou d'un mot pouvait revenir au bloc suivant —
    // même phrase, même trou — parce que chaque bloc repiochait dans tout le
    // bassin sans mémoire de ce qui avait déjà été servi.
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      const sigs = targeted(session).map(signature)
      expect(new Set(sigs).size).toBe(sigs.length)
    }
  })

  it('interroge chaque mot au moins une fois hors des manches d’association', () => {
    // Régression : un tirage uniforme laissait des mots sans le moindre
    // exercice ciblé — vus à la présentation, noyés ensuite dans les paires.
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
      const touched = new Set(targeted(session).flatMap(itemIdsOf))
      expect(touched.size).toBe(LESSON.length)
    }
  })

  it('varie l’énoncé des QCM au lieu de toujours demander la forme anglaise', () => {
    const cues = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const exercise of buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)) {
        if (exercise.kind === 'choice') cues.add(exercise.cue)
      }
    }
    expect(cues.size).toBeGreaterThanOrEqual(3)
  })

  it('n’enchaîne pas des manches d’association identiques', () => {
    // Régression : au premier bloc le bassin fait exactement MATCH_SIZE, si
    // bien que trois manches d'affilée portaient les mêmes quatre mots.
    for (const seed of [1, 2, 3, 4, 5]) {
      const rounds = buildLessonSession(lessonOf('u1-l1', LESSON), 0, seed, {}, true)
        .filter((e) => e.kind === 'match')
        .map((e) => e.pairs.map((p) => p.id).sort().join())
      expect(new Set(rounds).size).toBe(rounds.length)
    }
  })

  it('ne demande le mot à l’oreille que si l’appareil sait prononcer', () => {
    const silent = buildLessonSession(lessonOf('u1-l1', LESSON), 0, 1, {}, false)
    expect(silent.some((e) => e.kind === 'choice' && e.cue === 'audio')).toBe(false)
  })

})

describe('ne pas retomber sur les mêmes exercices', () => {
  const item = (index: number): PracticeItem => ({
    kind: 'vocab',
    id: LESSON[index].id,
    vocab: LESSON[index],
  })

  /** Ce qu'une carte reçoit à sa `n`-ième révision, tout étant réussi. */
  const overReviews = (base: Partial<CardState>, count: number): string[] =>
    Array.from({ length: count }, (_, reps) => {
      const entries = LESSON.map((_word, index) => ({
        card: { ...createCard(LESSON[index].id, T0), ...base, reps },
        item: item(index),
      }))
      const session = buildReviewSession(entries, undefined, true)
      return session.find((exercise) => itemIdsOf(exercise).includes(LESSON[0].id))!.id
    })

  it('ne sert jamais deux fois de suite le même exercice sur une carte mûre', () => {
    // Régression : la forme se tirait au sort à chaque révision, sans mémoire
    // de la précédente. Sur une carte en production — deux formes possibles —
    // le même exercice revenait jusqu'à treize fois d'affilée.
    const seen = overReviews({ step: null, interval: 40 }, 12)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('ne sert jamais deux fois de suite le même exercice sur une carte jeune', () => {
    const seen = overReviews({ step: 0 }, 12)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
  })

  it('fait le tour des énoncés disponibles plutôt que d’en privilégier un', () => {
    // Une carte en apprentissage a une phrase à trou et trois énoncés de QCM.
    expect(new Set(overReviews({ step: 0 }, 10)).size).toBe(4)
  })

  it('ne redonne pas la même session quand les cartes ont avancé', () => {
    const sessionAt = (reps: number) =>
      buildReviewSession(
        LESSON.map((_word, index) => ({
          card: { ...createCard(LESSON[index].id, T0), reps },
          item: item(index),
        })),
        undefined,
        true,
      )
        .map((exercise) => exercise.id)
        .join('|')

    // Régression : la graine par défaut ne tenait qu'au nombre de cartes et à
    // la première d'entre elles — deux choses qui se répètent d'un jour à
    // l'autre, les cartes échues ensemble revenant ensemble.
    expect(new Set([0, 1, 2, 3].map(sessionAt)).size).toBe(4)
  })

  it('redonne la même session tant que rien n’a été répondu', () => {
    // La contrepartie : une session interrompue se reprend à l'identique.
    const entries = LESSON.map((_word, index) => ({
      card: createCard(LESSON[index].id, T0),
      item: item(index),
    }))
    expect(buildReviewSession(entries, undefined, true).map((e) => e.id)).toEqual(
      buildReviewSession(entries, undefined, true).map((e) => e.id),
    )
  })

  it('ne redonne pas la même leçon quand on la rejoue', () => {
    // Régression : la graine d'une leçon tenait au seul compteur de
    // tentatives, qui ne bouge qu'avec « Recommencer » — rouvrir la leçon
    // repartait donc de zéro et rejouait la même session. Et l'avancement des
    // cartes ne suffit pas à lui seul : `srs.review` laisse volontairement où
    // elle est une carte revue le jour même.
    const lesson = lessonOf('u1-l1', LESSON)
    const cards: Record<string, CardState> = {}
    const sessions: string[] = []
    let now = T0

    for (let pass = 0; pass < 4; pass++) {
      const seed = seedFrom(lesson.id, 0, 0, lessonProgress(lesson, cards))
      sessions.push(
        buildLessonSession(lesson, 0, seed, cards, true)
          .map((exercise) => exercise.id)
          .join('|'),
      )
      for (const vocab of LESSON) {
        now += 30_000
        cards[vocab.id] = review(cards[vocab.id] ?? createCard(vocab.id, now), 'good', now)
      }
    }
    expect(new Set(sessions).size).toBe(4)
  })

  it('redonne la même leçon tant que rien n’a été répondu', () => {
    const lesson = lessonOf('u1-l1', LESSON)
    const cards: Record<string, CardState> = Object.fromEntries(
      LESSON.map((vocab) => [vocab.id, createCard(vocab.id, T0)]),
    )
    const build = () =>
      buildLessonSession(lesson, 0, seedFrom(lesson.id, 0, 0, lessonProgress(lesson, cards)), cards, true)
        .map((exercise) => exercise.id)
        .join('|')
    expect(build()).toBe(build())
  })

  it('ne sert pas le même exercice à la révision et à l’entraînement du jour', () => {
    // Les deux étapes se suivent sur le parcours : tomber sur le même
    // exercice à quelques minutes d'intervalle ne teste rien de plus.
    const entries = LESSON.map((_word, index) => ({
      card: { ...createCard(LESSON[index].id, T0), step: null, interval: 40, reps: 3 },
      item: item(index),
    }))
    const target = (session: Exercise[]) =>
      session.find((exercise) => itemIdsOf(exercise).includes(LESSON[0].id))!.id
    expect(target(buildPracticeSession(entries, undefined, true))).not.toBe(
      target(buildReviewSession(entries, undefined, true)),
    )
  })
})

describe('session de révision', () => {
  const entries = (states: Partial<CardState>[]): { card: CardState; item: PracticeItem }[] =>
    states.map((state, index) => ({
      card: { ...createCard(LESSON[index].id, T0), ...state },
      item: { kind: 'vocab', id: LESSON[index].id, vocab: LESSON[index] },
    }))

  it('est vide sans carte échue', () => {
    expect(buildReviewSession([])).toEqual([])
  })

  it('teste chaque carte au moins une fois', () => {
    const session = buildReviewSession(entries([{}, {}, {}, {}]))
    const covered = new Set(session.flatMap((exercise) => itemIdsOf(exercise)))
    expect(covered.size).toBeGreaterThanOrEqual(4)
  })

  it('demande la production libre sur les cartes solides', () => {
    const solid = entries([
      { step: null, interval: 40 },
      { step: null, interval: 60 },
      { step: null, interval: 90 },
      { step: null, interval: 120 },
    ])
    const session = buildReviewSession(solid).filter((e) => e.kind !== 'match')
    expect(session.every((e) => e.kind === 'type' || e.kind === 'cloze')).toBe(true)
    expect(session.every((e) => e.kind !== 'type' || e.direction === 'to-learning')).toBe(true)
  })

  it('reste en reconnaissance sur les cartes fragiles', () => {
    const fragile = entries([{ step: 0 }, { step: 0 }, { step: 1 }, { step: 0 }])
    const session = buildReviewSession(fragile).filter((e) => e.kind !== 'match')
    expect(
      session.every(
        (e) => e.kind === 'flashcard' || e.kind === 'choice' || (e.kind === 'cloze' && e.bank !== null),
      ),
    ).toBe(true)
  })

  it('varie la reconnaissance entre QCM et phrase à trou', () => {
    // Régression : la carte encore en apprentissage ne recevait jamais de QCM
    // en révision, alors que la leçon d'origine en proposait déjà plusieurs.
    // La variété se prend d'une révision à l'autre, pas d'une graine à
    // l'autre : c'est le nombre de répétitions qui fait tourner les formes.
    const kinds = new Set<string>()
    for (let reps = 0; reps < 6; reps++) {
      const fragile = entries([{ step: 0, reps }, { step: 0, reps }, { step: 1, reps }, { step: 0, reps }])
      for (const e of buildReviewSession(fragile)) kinds.add(e.kind)
    }
    expect(kinds).toContain('choice')
    expect(kinds).toContain('cloze')
  })

  it('ne redemande pas l’auto-évaluation de la flashcard quand un test est possible', () => {
    // Le mot l'a déjà reçue une fois à sa présentation (voir VocabIntro) :
    // avec un bassin fourni (QCM possible) et un exemple (phrase à trou
    // possible), la flashcard ne doit plus jamais réapparaître en révision.
    const kinds = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const fragile = entries([{ step: 0 }, { step: 0 }, { step: 1 }, { step: 0 }])
      for (const e of buildReviewSession(fragile, seed)) kinds.add(e.kind)
    }
    expect(kinds).not.toContain('flashcard')
  })

  it('retombe sur la flashcard en dernier ressort, sans QCM ni phrase à trou possibles', () => {
    // Une seule carte en session (aucun leurre pour un QCM) et un mot sans
    // exemple (pas de phrase à trou) : plus aucun test n'est constructible,
    // l'auto-évaluation reste alors le seul moyen de faire avancer la carte.
    const bare = word('bare', 'bare', 'nu')
    const session = buildReviewSession([{ card: createCard('bare', T0), item: { kind: 'vocab', id: 'bare', vocab: bare } }])
    expect(session.map((e) => e.kind)).toEqual(['flashcard'])
  })

  it('fait traduire vers le français avant d’exiger le mot anglais', () => {
    // Après une première révision réussie l'intervalle vaut 3 jours : la carte
    // sort de la reconnaissance, mais le mot anglais n'est pas encore
    // récupérable page blanche. On retire les aides sans changer de sens :
    // la réponse se donne en français, ou dans une phrase qui porte le mot.
    const early = entries([
      { step: null, interval: 3 },
      { step: null, interval: 3 },
      { step: null, interval: 3 },
      { step: null, interval: 3 },
    ])
    const session = buildReviewSession(early).filter((e) => e.kind !== 'match')
    expect(session.length).toBeGreaterThan(0)
    expect(session.every((e) => e.kind === 'type' || (e.kind === 'cloze' && e.bank === null))).toBe(true)
    expect(session.every((e) => e.kind !== 'type' || e.direction === 'to-known')).toBe(true)
  })
})

describe('session d’entraînement', () => {
  const entries = (states: Partial<CardState>[]): { card: CardState; item: PracticeItem }[] =>
    states.map((state, index) => ({
      card: { ...createCard(LESSON[index].id, T0), ...state },
      item: { kind: 'vocab', id: LESSON[index].id, vocab: LESSON[index] },
    }))

  it('est vide sans élément déjà rencontré', () => {
    expect(buildPracticeSession([])).toEqual([])
  })

  it('n’exige jamais le mot anglais d’une carte encore en apprentissage', () => {
    // Régression : l'entraînement forçait la production libre sur toutes ses
    // cartes, y compris des mots présentés quelques minutes plus tôt dans la
    // leçon qui précède l'étape. On réclamait un rappel que la mémoire ne
    // pouvait pas encore fournir — la banque de mots reste, elle aussi.
    const fragile = entries([{ step: 0 }, { step: 0 }, { step: 1 }, { step: 0 }])
    const session = buildPracticeSession(fragile).filter((e) => e.kind !== 'match')
    expect(session.length).toBeGreaterThan(0)
    expect(session.some((e) => e.kind === 'type' && e.direction === 'to-learning')).toBe(false)
    expect(session.every((e) => e.kind !== 'cloze' || e.bank !== null)).toBe(true)
  })

  it('retire les aides sur les cartes mûres', () => {
    // L'exigence de l'entraînement porte là : plus de banque de mots, plus
    // d'auto-évaluation, et le mot se produit en anglais.
    const solid = entries([
      { step: null, interval: 40 },
      { step: null, interval: 60 },
      { step: null, interval: 90 },
      { step: null, interval: 120 },
    ])
    const session = buildPracticeSession(solid).filter((e) => e.kind !== 'match')
    expect(session.length).toBeGreaterThan(0)
    expect(
      session.every(
        (e) => (e.kind === 'cloze' && e.bank === null) || (e.kind === 'type' && e.direction === 'to-learning'),
      ),
    ).toBe(true)
  })

  it('couvre chaque élément fourni', () => {
    const session = buildPracticeSession(entries([{}, {}, {}, {}]))
    const covered = new Set(session.flatMap((exercise) => itemIdsOf(exercise)))
    expect(covered.size).toBeGreaterThanOrEqual(4)
  })
})

describe('correction des réponses saisies', () => {
  const sorry = LESSON[2]

  it('accepte la traduction attendue', () => {
    expect(isAnswerCorrect(sorry, 'to-known', 'désolé')).toBe(true)
  })

  it('accepte les variantes déclarées', () => {
    expect(isAnswerCorrect(sorry, 'to-known', 'pardon')).toBe(true)
  })

  it('tolère accents, casse, espaces et ponctuation', () => {
    expect(isAnswerCorrect(sorry, 'to-known', '  Desole. ')).toBe(true)
  })

  it('tolère un article ou un « to » en tête', () => {
    const toGo = word('to-go', 'to go', 'aller')
    expect(isAnswerCorrect(toGo, 'to-learning', 'go')).toBe(true)
    const bread = word('bread', 'bread', 'pain')
    expect(isAnswerCorrect(bread, 'to-known', 'le pain')).toBe(true)
  })

  it('refuse une réponse vide ou fausse', () => {
    expect(isAnswerCorrect(sorry, 'to-known', '')).toBe(false)
    expect(isAnswerCorrect(sorry, 'to-known', '   ')).toBe(false)
    expect(isAnswerCorrect(sorry, 'to-known', 'merci')).toBe(false)
  })

  it('vérifie le mot anglais dans l’autre sens', () => {
    expect(isAnswerCorrect(sorry, 'to-learning', 'sorry')).toBe(true)
    expect(isAnswerCorrect(sorry, 'to-learning', 'désolé')).toBe(false)
  })

  it('ignore apostrophes droites, typographiques et accents', () => {
    expect(normalizeAnswer("S’il vous plaît !")).toBe(normalizeAnswer('sil vous plait'))
    expect(isAnswerCorrect(LESSON[3], 'to-known', "s’il vous plait")).toBe(true)
  })
})

// --- Grammaire et conjugaison -------------------------------------------

const GRAMMAR: GrammarLesson = {
  kind: 'grammar',
  id: 'g1-l1',
  title: 'Le conditionnel mixte',
  notes: 'Une hypothèse passée, une conséquence présente.',
  points: [
    { id: 'p1', sentence: 'If I had known, I ___ there.', answer: 'would be', alt: [], options: ['would be', 'would have been', 'will be'], translation: 'Si j’avais su, je serais là.' },
    // p2 est le point volontairement pauvre : pas de formes proposées, donc ni
    // QCM ni banque de mots — il ne peut se travailler qu'au clavier.
    { id: 'p2', sentence: 'She ___ that message.', answer: 'would not have sent', alt: ["wouldn't have sent"], options: [], translation: 'Elle n’aurait pas envoyé ce message.' },
    { id: 'p3', sentence: 'We ___ stuck now.', answer: 'would not be', alt: [], options: ['would not be', 'had not been'], translation: 'Nous ne serions pas coincés maintenant.' },
  ],
}

const CONJUGATION: ConjugationLesson = {
  kind: 'conjugation',
  id: 'c1-l1',
  title: 'Present perfect',
  notes: 'have / has + participe passé.',
  verbs: [
    {
      verb: 'to see',
      translation: 'voir',
      tense: 'present perfect',
      forms: [
        { id: 'f1', person: 'I / you / we / they', answer: 'have seen', alt: [] },
        { id: 'f2', person: 'he / she / it', answer: 'has seen', alt: [] },
      ],
    },
    {
      verb: 'to go',
      translation: 'aller',
      tense: 'present perfect',
      forms: [
        { id: 'f3', person: 'I / you / we / they', answer: 'have gone', alt: [] },
        { id: 'f4', person: 'he / she / it', answer: 'has gone', alt: [] },
      ],
    },
  ],
}

describe('session de grammaire', () => {
  it('ouvre sur le rappel de cours à la découverte, plus après', () => {
    expect(kinds(buildLessonSession(GRAMMAR, 0))[0]).toBe('rule')
    expect(kinds(buildLessonSession(GRAMMAR, 1))).not.toContain('rule')
  })

  it('teste chaque point de la leçon', () => {
    const points = buildLessonSession(GRAMMAR, 1).flatMap(itemIdsOf)
    expect(new Set(points)).toEqual(new Set(['p1', 'p2', 'p3']))
  })

  it('propose les formes à la découverte, les retire ensuite', () => {
    const guided = buildLessonSession(GRAMMAR, 0).filter((e) => e.kind === 'grammar-gap')
    const free = buildLessonSession(GRAMMAR, 2).filter((e) => e.kind === 'grammar-gap')
    // p2 n'a pas d'options : il reste au clavier même à la découverte.
    expect(guided.find((e) => e.point.id === 'p1')?.bank).toContain('would be')
    expect(guided.find((e) => e.point.id === 'p2')?.bank).toBeNull()
    expect(free.every((e) => e.bank === null)).toBe(true)
  })

  it('n’ajoute pas de rappel quand la leçon n’en déclare pas', () => {
    const { notes: _notes, ...bare } = GRAMMAR
    expect(kinds(buildLessonSession(bare as GrammarLesson, 0))).not.toContain('rule')
  })

  it('propose aussi le QCM de phrase à l’audio quand l’appareil sait parler', () => {
    // Même raisonnement que la conjugaison : sans cette variante, choisir la
    // phrase entière ne se jouait jamais qu'à la lecture, alors que les
    // options ne diffèrent que par une terminaison — exactement ce qui
    // s'entend à l'oreille.
    const cues = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = buildLessonSession(GRAMMAR, 0, seed, {}, true).filter((e) => e.kind === 'grammar-choice')
      for (const exercise of session) cues.add(exercise.cue)
    }
    expect(cues).toContain('audio')
  })

  it('ne propose jamais le QCM de phrase à l’audio sans synthèse vocale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(GRAMMAR, 0, seed).filter((e) => e.kind === 'grammar-choice')
      expect(session.every((e) => e.cue !== 'audio')).toBe(true)
    }
  })
})

describe('session de conjugaison', () => {
  it('relie les paradigmes avant de faire produire', () => {
    const session = kinds(buildLessonSession(CONJUGATION, 0))
    expect(session[0]).toBe('rule')
    expect(session.indexOf('conjugation-match')).toBeLessThan(session.indexOf('conjugation'))
  })

  it('ne demande plus que la production au dernier niveau', () => {
    const session = kinds(buildLessonSession(CONJUGATION, 2))
    expect(session.every((kind) => kind === 'conjugation')).toBe(true)
  })

  it('couvre toutes les formes déclarées', () => {
    const typed = buildLessonSession(CONJUGATION, 2).filter((e) => e.kind === 'conjugation')
    expect(new Set(typed.map((e) => e.form.id))).toEqual(new Set(['f1', 'f2', 'f3', 'f4']))
  })

  it('note les formes, pas les verbes', () => {
    const match = buildLessonSession(CONJUGATION, 0).find((e) => e.kind === 'conjugation-match')!
    expect(itemIdsOf(match).sort()).toEqual(['f1', 'f2'])
  })

  it('présente chaque verbe isolément à la découverte', () => {
    const matches = buildLessonSession(CONJUGATION, 0).filter((e) => e.kind === 'conjugation-match')
    // Deux verbes dans la leçon : mélanger dès la présentation escamoterait
    // le tableau du second avant qu'il ait été montré seul.
    expect(matches).toHaveLength(2)
    expect(matches.every((e) => e.verbs.length === 1)).toBe(true)
  })

  it('mélange les verbes du bloc dans le rappel du second passage', () => {
    // Régression : le rappel ne reprenait qu'un verbe tiré au hasard, un
    // second passage sur exactement la même petite manche à deux paires que
    // la présentation venait de montrer.
    const matches = buildLessonSession(CONJUGATION, 1).filter((e) => e.kind === 'conjugation-match')
    expect(matches).toHaveLength(1)
    expect(matches[0]!.verbs.length).toBeGreaterThan(1)
    expect(itemIdsOf(matches[0]!).sort()).toEqual(['f1', 'f2', 'f3', 'f4'])
  })

  it('va chercher un partenaire ailleurs pour le verbe qui reste seul dans son bloc', () => {
    // Régression : un nombre impair de verbes (fréquent en contenu réel — B1
    // en a onze leçons sur onze) laisse le dernier bloc à un seul verbe, sans
    // partenaire dans son propre bloc. Sans correctif, il restait condamné à
    // une manche solitaire pour toute la leçon, jamais mélangé.
    const three: ConjugationLesson = {
      ...CONJUGATION,
      verbs: [
        ...CONJUGATION.verbs,
        {
          verb: 'to eat',
          translation: 'manger',
          tense: 'present perfect',
          forms: [
            { id: 'f5', person: 'I / you / we / they', answer: 'have eaten', alt: [] },
            { id: 'f6', person: 'he / she / it', answer: 'has eaten', alt: [] },
          ],
        },
      ],
    }
    for (const seed of [1, 2, 3, 4, 5]) {
      const matches = buildLessonSession(three, 1, seed).filter((e) => e.kind === 'conjugation-match')
      expect(matches.every((e) => e.verbs.length > 1)).toBe(true)
    }
  })

  it('propose aussi la reconnaissance à l’audio quand l’appareil sait parler', () => {
    // Sans elle, la conjugaison restait la seule piste à ne jamais faire
    // travailler l'oreille, alors que le vocabulaire l'a déjà en QCM, thème
    // et association.
    const cues = new Set<string>()
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = buildLessonSession(CONJUGATION, 0, seed, {}, true).filter((e) => e.kind === 'conjugation-choice')
      for (const exercise of session) cues.add(exercise.cue)
    }
    expect(cues).toContain('audio')
  })

  it('ne propose jamais la reconnaissance à l’audio sans synthèse vocale', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = buildLessonSession(CONJUGATION, 0, seed).filter((e) => e.kind === 'conjugation-choice')
      expect(session.every((e) => e.cue !== 'audio')).toBe(true)
    }
  })
})

describe('révision toutes natures confondues', () => {
  it('rend à chaque élément son exercice propre', () => {
    const items: { card: CardState; item: PracticeItem }[] = [
      { card: createCard('p1', T0), item: { kind: 'grammar', id: 'p1', point: GRAMMAR.points[0] } },
      { card: createCard('f1', T0), item: { kind: 'conjugation', id: 'f1', form: CONJUGATION.verbs[0].forms[0], verb: CONJUGATION.verbs[0] } },
      { card: createCard(LESSON[0].id, T0), item: { kind: 'vocab', id: LESSON[0].id, vocab: LESSON[0] } },
    ]
    const session = buildReviewSession(items)
    // Carte de grammaire encore jeune : phrase à trou ou QCM, les deux sont
    // de la reconnaissance — voir « varie la reconnaissance… » plus haut.
    expect(session.some((e) => e.kind === 'grammar-gap' || e.kind === 'grammar-choice')).toBe(true)
    // Carte de conjugaison encore en apprentissage : on la reconnaît.
    expect(session.some((e) => e.kind === 'conjugation-choice')).toBe(true)
  })

  it('ne réclame la forme conjuguée de mémoire qu’une fois la carte mûre', () => {
    const fresh = createCard('f1', T0)
    const item: PracticeItem = {
      kind: 'conjugation',
      id: 'f1',
      form: CONJUGATION.verbs[0].forms[0],
      verb: CONJUGATION.verbs[0],
    }
    // Régression : la révision réclamait d'écrire « have seen » de mémoire dès
    // le jour de la découverte, ce qui n'enseigne que l'échec.
    expect(buildReviewSession([{ card: fresh, item }])[0]!.kind).toBe('conjugation-choice')

    const mature: CardState = { ...fresh, step: null, interval: 10 }
    expect(buildReviewSession([{ card: mature, item }])[0]!.kind).toBe('conjugation')
  })

  it('retire la traduction française des phrases de grammaire à l’entraînement', () => {
    const item: PracticeItem = { kind: 'grammar', id: 'p1', point: GRAMMAR.points[0] }
    const card = createCard('p1', T0)
    // L'entraînement est toujours en production, jamais en QCM : pas de repli
    // vers le plus facile une fois que l'étape en réclame la production.
    for (let seed = 0; seed < 20; seed++) {
      expect(buildPracticeSession([{ card, item }], seed)[0]).toMatchObject({
        kind: 'grammar-gap',
        cue: 'sentence',
      })
    }
    // La révision, elle, reconnaît d'abord : QCM ou phrase à trou avec sa
    // traduction — jamais la phrase à trou nue, réservée aux cartes mûres. Les
    // deux se relaient d'une révision à la suivante.
    const kinds = new Set<string>()
    for (let reps = 0; reps < 4; reps++) {
      const [review] = buildReviewSession([{ card: { ...card, reps }, item }])
      kinds.add(review!.kind)
      if (review!.kind === 'grammar-gap') expect(review).toMatchObject({ cue: 'translation' })
    }
    expect(kinds).toEqual(new Set(['grammar-gap', 'grammar-choice']))
  })

  it('propose parfois le QCM de grammaire à l’audio en révision', () => {
    const item: PracticeItem = { kind: 'grammar', id: 'p1', point: GRAMMAR.points[0] }
    const fresh = createCard('p1', T0)
    const cues = new Set<string>()
    for (let reps = 0; reps < 8; reps++) {
      const [exercise] = buildReviewSession([{ card: { ...fresh, reps }, item }], undefined, true)
      if (exercise!.kind === 'grammar-choice') cues.add(exercise.cue)
    }
    expect(cues).toContain('audio')
  })

  it('propose parfois la révision de conjugaison à l’audio', () => {
    const item: PracticeItem = {
      kind: 'conjugation',
      id: 'f1',
      form: CONJUGATION.verbs[0].forms[0],
      verb: CONJUGATION.verbs[0],
    }
    const fresh = createCard('f1', T0)
    const cues = new Set<string>()
    for (let reps = 0; reps < 8; reps++) {
      const [exercise] = buildReviewSession([{ card: { ...fresh, reps }, item }], undefined, true)
      if (exercise!.kind === 'conjugation-choice') cues.add(exercise.cue)
    }
    expect(cues).toContain('audio')
  })

  it('fait parfois partir la conjugaison du français sur une carte mûre', () => {
    // Le rappel réellement utile pour parler : personne ne part en
    // conversation d'un infinitif anglais déjà trouvé.
    const item: PracticeItem = {
      kind: 'conjugation',
      id: 'f1',
      form: CONJUGATION.verbs[0].forms[0],
      verb: CONJUGATION.verbs[0],
    }
    const mature: CardState = { ...createCard('f1', T0), step: null, interval: 10 }
    const cues = new Set<string>()
    for (let reps = 0; reps < 4; reps++) {
      const [exercise] = buildReviewSession([{ card: { ...mature, reps }, item }])
      expect(exercise!.kind).toBe('conjugation')
      if (exercise!.kind === 'conjugation') cues.add(exercise.cue)
    }
    expect(cues).toEqual(new Set(['verb', 'translation']))
  })
})

describe('variété des exercices de grammaire et de conjugaison', () => {
  /** Signature d'un exercice ciblé : l'élément ET la question posée. */
  function signature(exercise: Exercise): string {
    const cue = 'cue' in exercise ? `:${exercise.cue}` : ''
    const bank = 'bank' in exercise ? (exercise.bank ? ':banque' : ':clavier') : ''
    return `${exercise.kind}${cue}${bank}:${itemIdsOf(exercise).join()}`
  }

  const SEEDS = [1, 2, 3, 4, 5]
  const LEVELS = [0, 1, 2]

  it('ne pose jamais deux fois la même question sur le même point', () => {
    // Régression : la leçon ne posait qu'une phrase à trou par point, toujours
    // la même, si bien que six points faisaient six exercices d'un seul gabarit.
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const sigs = buildLessonSession(GRAMMAR, level, seed)
          .filter((e) => e.kind !== 'rule')
          .map(signature)
        expect(new Set(sigs).size).toBe(sigs.length)
      }
    }
  })

  it('ne pose jamais deux fois la même question sur la même forme', () => {
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const sigs = buildLessonSession(CONJUGATION, level, seed)
          .filter((e) => e.kind !== 'rule' && e.kind !== 'conjugation-match')
          .map(signature)
        expect(new Set(sigs).size).toBe(sigs.length)
      }
    }
  })

  it('interroge chaque point et chaque forme au moins deux fois', () => {
    // Un seul exercice par élément, c'était le fond du problème : le passage
    // suivant ne pouvait que reposer la même question.
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        for (const point of GRAMMAR.points) {
          const asked = buildLessonSession(GRAMMAR, level, seed).filter((e) =>
            itemIdsOf(e).includes(point.id),
          )
          expect(asked.length).toBeGreaterThanOrEqual(2)
        }
        const forms = CONJUGATION.verbs.flatMap((verb) => verb.forms)
        for (const form of forms) {
          const asked = buildLessonSession(CONJUGATION, level, seed).filter(
            (e) => e.kind !== 'conjugation-match' && itemIdsOf(e).includes(form.id),
          )
          expect(asked.length).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('fait monter l’exigence avec la maîtrise', () => {
    const stages = (lesson: GrammarLesson | ConjugationLesson, level: number) =>
      new Set(SEEDS.flatMap((seed) => buildLessonSession(lesson, level, seed)).map((e) => e.kind))

    // À la découverte on reconnaît la phrase, on ne l'écrit pas ; une fois la
    // leçon sue, le QCM disparaît et il ne reste que la production.
    expect(stages(GRAMMAR, 0)).toContain('grammar-choice')
    expect(stages(GRAMMAR, 2)).not.toContain('grammar-choice')
    expect(stages(CONJUGATION, 0)).toContain('conjugation-choice')
    expect(stages(CONJUGATION, 2)).not.toContain('conjugation-choice')
  })

  it('demande parfois la forme à partir du français seul', () => {
    // Le rappel réellement utile pour parler : personne ne part de l'infinitif
    // anglais déjà trouvé.
    const cues = new Set(
      SEEDS.flatMap((seed) => buildLessonSession(CONJUGATION, 2, seed))
        .filter((e) => e.kind === 'conjugation')
        .map((e) => e.cue),
    )
    expect(cues).toEqual(new Set(['verb', 'translation']))
  })

  it('ne part du français que si le verbe en a une traduction', () => {
    const bare: ConjugationLesson = {
      ...CONJUGATION,
      verbs: CONJUGATION.verbs.map(({ translation: _translation, ...rest }) => rest),
    }
    for (const level of LEVELS) {
      for (const seed of SEEDS) {
        const session = buildLessonSession(bare, level, seed)
        expect(session.some((e) => 'cue' in e && e.cue === 'translation')).toBe(false)
      }
    }
  })

  it('propose des phrases entières distinctes, dont la bonne', () => {
    const choices = SEEDS.flatMap((seed) => buildLessonSession(GRAMMAR, 0, seed)).filter(
      (e) => e.kind === 'grammar-choice',
    )
    expect(choices.length).toBeGreaterThan(0)
    for (const choice of choices) {
      expect(new Set(choice.options).size).toBe(choice.options.length)
      expect(choice.options).toContain(fillGap(choice.point.sentence, choice.point.answer))
      // p2 n'a pas d'options : il ne peut pas produire de QCM du tout.
      expect(choice.point.id).not.toBe('p2')
    }
  })

  it('oppose d’abord les autres personnes du même verbe', () => {
    // « have seen » contre « has seen » : c'est là que la confusion se joue,
    // pas entre deux verbes sans rapport.
    const choices = SEEDS.flatMap((seed) => buildLessonSession(CONJUGATION, 0, seed)).filter(
      (e) => e.kind === 'conjugation-choice',
    )
    expect(choices.length).toBeGreaterThan(0)
    for (const choice of choices) {
      const siblings = choice.verb.forms.filter((form) => form.id !== choice.form.id)
      expect(choice.options).toContain(choice.form.answer)
      expect(choice.options.some((option) => siblings.some((form) => form.answer === option))).toBe(true)
    }
  })
})

describe('correction grammaire et conjugaison', () => {
  it('découpe la phrase autour du marqueur', () => {
    expect(splitGap('If I ___ there.')).toEqual({ before: 'If I ', after: ' there.' })
  })

  it('renvoie la phrase entière sans marqueur', () => {
    expect(splitGap('Pas de trou ici.')).toEqual({ before: 'Pas de trou ici.', after: '' })
  })

  it('accepte la réponse attendue et ses variantes', () => {
    expect(matchesAnswer('would not have sent', ["wouldn't have sent"], "wouldn't have sent")).toBe(true)
    expect(matchesAnswer('has seen', [], 'HAS SEEN')).toBe(true)
    expect(matchesAnswer('has seen', [], 'have seen')).toBe(false)
    expect(matchesAnswer('has seen', [], '')).toBe(false)
  })

  it('distingue l’article et le « to », qui font l’objet de l’exercice', () => {
    // Régression : la comparaison lâche du vocabulaire retirait l'article et
    // le « to », si bien qu'une leçon sur « little » vs « a little » acceptait
    // les deux, et qu'un leurre comme « the shorter » passait pour correct.
    expect(matchesAnswer('little', [], 'a little')).toBe(false)
    expect(matchesAnswer('shorter', [], 'the shorter')).toBe(false)
    expect(matchesAnswer('to postpone', [], 'postpone')).toBe(false)
    // Une variante réellement acceptable reste déclarée par l'auteur.
    expect(matchesAnswer('boils', ['boiled'], 'boiled')).toBe(true)
  })

  it('reste souple sur l’article pour le vocabulaire', () => {
    const vocab: Vocab = { id: 'w', term: 'to tackle', translation: "s'attaquer à", alt: [] }
    expect(isAnswerCorrect(vocab, 'to-learning', 'tackle')).toBe(true)
    expect(isAnswerCorrect(vocab, 'to-learning', 'to tackle')).toBe(true)
  })
})
