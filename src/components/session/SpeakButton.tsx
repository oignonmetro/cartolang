import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { canSpeak, speak } from '@/lib/speech'
import { SpeakerIcon } from '@/components/icons'
import { useProgress } from '@/store/progressStore'

/**
 * Bouton d'écoute d'un mot anglais.
 *
 * Rien ne s'affiche là où l'appareil ne sait pas parler : un haut-parleur qui
 * ne fait jamais de bruit se lit comme une panne. Le bouton n'a pas non plus
 * d'état « en train de parler » fiable — le moteur natif ne le rapporte pas —
 * donc l'appui donne un retour visuel bref plutôt que de prétendre suivre la
 * lecture.
 */
export function SpeakButton({
  text,
  /** Prononce le mot dès l'affichage, si l'apprenant l'a laissé activé. */
  auto = false,
  size = 22,
  className = '',
}: {
  text: string
  auto?: boolean
  size?: number
  className?: string
}) {
  const autoSpeak = useProgress((state) => state.autoSpeak)
  const [pulsing, setPulsing] = useState(false)
  // La lecture automatique ne doit partir qu'une fois par mot, pas à chaque
  // rendu — un changement d'état de l'écran relancerait sinon le son.
  const spokenFor = useRef<string | null>(null)

  useEffect(() => {
    if (!auto || !autoSpeak || !canSpeak) return
    if (spokenFor.current === text) return
    spokenFor.current = text
    void speak(text)
  }, [auto, autoSpeak, text])

  if (!canSpeak) return null

  return (
    <motion.button
      type="button"
      onClick={(event) => {
        // Le bouton vit souvent dans une carte elle-même cliquable : écouter
        // un mot ne doit pas déclencher ce que fait la carte autour.
        event.stopPropagation()
        setPulsing(true)
        void speak(text)
        window.setTimeout(() => setPulsing(false), 400)
      }}
      whileTap={{ scale: 0.9 }}
      animate={pulsing ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.4 }}
      aria-label={`Écouter « ${text} »`}
      className={`inline-flex items-center justify-center rounded-full border-2 border-line bg-paper p-2 text-teal transition-colors hover:border-teal ${className}`}
    >
      <SpeakerIcon size={size} />
    </motion.button>
  )
}
