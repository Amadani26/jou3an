import { useEffect, useState } from 'react'

const WORDS = ['Thinking...', 'Deciding...', 'Almost...']

export default function ProcessingState() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % WORDS.length)
    }, 700)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center gap-5 py-16">
      <div className="flex items-center gap-2.5">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="w-2.5 h-2.5 rounded-full bg-red bounce-dot"
            style={{ animationDelay: `${d * 0.15}s` }}
          />
        ))}
      </div>
      <div className="font-display font-bold text-xl text-text-primary">
        {WORDS[index]}
      </div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">
        Analysing your vibe
      </div>
    </div>
  )
}
