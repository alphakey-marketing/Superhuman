import { useState, useEffect, useRef } from 'react'
import { X, Wind, Leaf, Music, ChevronRight, Smile, Meh, Frown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BREAK_DURATIONS } from '../../types'

interface Props {
  userId: string
  onClose: () => void
}

type BreakType = 'nature' | 'breathing' | 'binaural'

const BREAK_OPTIONS = [
  {
    id: 'nature' as BreakType,
    label: 'Nature Sounds',
    icon: Leaf,
    color: '#10b981',
    bg: 'from-emerald-950/60 to-teal-950/60',
    border: 'border-emerald-800/40',
    description: 'Restore attention with natural soundscapes',
    science: 'Attention Restoration Theory: effortless stimuli replenish directed focus',
  },
  {
    id: 'breathing' as BreakType,
    label: 'Box Breathing',
    icon: Wind,
    color: '#3b82f6',
    bg: 'from-blue-950/60 to-indigo-950/60',
    border: 'border-blue-800/40',
    description: 'Calm your nervous system with 4-4-4-4 breathing',
    science: 'Regulates cortisol and activates parasympathetic nervous system',
  },
  {
    id: 'binaural' as BreakType,
    label: 'Binaural Beats',
    icon: Music,
    color: '#8b5cf6',
    bg: 'from-purple-950/60 to-violet-950/60',
    border: 'border-purple-800/40',
    description: 'Alpha waves (10Hz) to ease into relaxed awareness',
    science: 'Alpha binaural beats linked to increased relaxation and reduced anxiety',
  },
]

const MOOD_OPTIONS = [
  { value: 1, icon: Frown, label: 'Drained', color: 'text-red-400' },
  { value: 3, icon: Meh, label: 'Okay', color: 'text-yellow-400' },
  { value: 5, icon: Smile, label: 'Refreshed', color: 'text-green-400' },
]

// Nature images from Unsplash (free, no API key needed for direct URLs)
const NATURE_IMAGES = [
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  'https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?w=800&q=80',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80',
  'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&q=80',
]

// Generate binaural beat tone using Web Audio API
function playBinauralBeat(durationSeconds: number): () => void {
  try {
    const ctx = new AudioContext()
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.08, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds)
    gainNode.connect(ctx.destination)

    // Left ear: 200Hz, Right ear: 210Hz → 10Hz alpha beat
    const leftOsc = ctx.createOscillator()
    const rightOsc = ctx.createOscillator()
    const leftPan = ctx.createStereoPanner()
    const rightPan = ctx.createStereoPanner()

    leftOsc.frequency.value = 200
    rightOsc.frequency.value = 210
    leftPan.pan.value = -1
    rightPan.pan.value = 1

    leftOsc.connect(leftPan).connect(gainNode)
    rightOsc.connect(rightPan).connect(gainNode)
    leftOsc.start()
    rightOsc.start()
    leftOsc.stop(ctx.currentTime + durationSeconds)
    rightOsc.stop(ctx.currentTime + durationSeconds)

    return () => { try { ctx.close() } catch (_) {} }
  } catch (_) {
    return () => {}
  }
}

// Generate gentle nature-like white noise
function playNatureSound(durationSeconds: number): () => void {
  try {
    const ctx = new AudioContext()
    const bufferSize = ctx.sampleRate * Math.min(durationSeconds, 30)
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate)

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
      for (let i = 0; i < bufferSize; i++) {
        // Pink noise algorithm for natural feel
        const white = Math.random() * 2 - 1
        b0=0.99886*b0+white*0.0555179; b1=0.99332*b1+white*0.0750759
        b2=0.96900*b2+white*0.1538520; b3=0.86650*b3+white*0.3104856
        b4=0.55000*b4+white*0.5329522; b5=-0.7616*b5-white*0.0168980
        data[i] = (b0+b1+b2+b3+b4+b5+b6+white*0.5362) * 0.04
        b6 = white * 0.115926
      }
    }

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds)
    gainNode.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gainNode)
    source.start()
    source.stop(ctx.currentTime + durationSeconds)

    return () => { try { ctx.close() } catch (_) {} }
  } catch (_) {
    return () => {}
  }
}

export default function RestorationBreak({ userId, onClose }: Props) {
  const [step, setStep] = useState<'pick' | 'session' | 'mood'>('pick')
  const [breakType, setBreakType] = useState<BreakType | null>(null)
  const [moodBefore, setMoodBefore] = useState<number | null>(null)
  const [moodAfter, setMoodAfter] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [breathPhase, setBreathPhase] = useState<'inhale'|'hold1'|'exhale'|'hold2'>('inhale')
  const [breathCount, setBreathCount] = useState(0)
  const [natureImg, setNatureImg] = useState(NATURE_IMAGES[0])
  const stopAudio = useRef<() => void>(() => {})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Breathing cycle: 4s inhale → 4s hold → 4s exhale → 4s hold
  useEffect(() => {
    if (step !== 'session' || breakType !== 'breathing') return
    const phases: Array<'inhale'|'hold1'|'exhale'|'hold2'> = ['inhale','hold1','exhale','hold2']
    let idx = 0
    const interval = setInterval(() => {
      idx = (idx + 1) % 4
      setBreathPhase(phases[idx])
      if (idx === 0) setBreathCount(c => c + 1)
    }, 4000)
    return () => clearInterval(interval)
  }, [step, breakType])

  // Countdown timer
  useEffect(() => {
    if (step !== 'session') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          handleSessionComplete()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [step])

  const handleSessionComplete = async () => {
    stopAudio.current()
    if (sessionId) {
      await supabase.from('rest_sessions').update({ completed: true }).eq('id', sessionId)
    }
    setStep('mood')
  }

  const startBreak = async (type: BreakType, mood: number) => {
    setBreakType(type)
    setMoodBefore(mood)
    const duration = BREAK_DURATIONS[type]
    setTotalTime(duration)
    setTimeLeft(duration)

    // Pick random nature image
    setNatureImg(NATURE_IMAGES[Math.floor(Math.random() * NATURE_IMAGES.length)])

    // Create DB record
    const { data } = await supabase
      .from('rest_sessions')
      .insert({ user_id: userId, type, duration_seconds: duration, mood_before: mood })
      .select().single()
    if (data) setSessionId(data.id)

    // Start audio
    if (type === 'binaural') stopAudio.current = playBinauralBeat(duration)
    if (type === 'nature') stopAudio.current = playNatureSound(duration)

    setStep('session')
  }

  const saveMood = async (mood: number) => {
    setMoodAfter(mood)
    if (sessionId) {
      await supabase.from('rest_sessions').update({ mood_after: mood }).eq('id', sessionId)
    }
  }

  const handleClose = () => {
    stopAudio.current()
    if (timerRef.current) clearInterval(timerRef.current)
    onClose()
  }

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs = String(timeLeft % 60).padStart(2, '0')
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0
  const option = BREAK_OPTIONS.find(o => o.id === breakType)

  const BREATH_LABELS: Record<string, string> = {
    inhale: 'Inhale...', hold1: 'Hold...', exhale: 'Exhale...', hold2: 'Hold...'
  }
  const BREATH_SCALE: Record<string, string> = {
    inhale: 'scale-110', hold1: 'scale-110', exhale: 'scale-90', hold2: 'scale-90'
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-950 rounded-3xl border border-gray-800 overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold">Restoration Break</h2>
            <p className="text-gray-500 text-xs mt-0.5">Science-backed attention recovery</p>
          </div>
          <button onClick={handleClose} className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Pick type + mood before */}
        {step === 'pick' && (
          <div className="p-5 space-y-5">
            <div>
              <p className="text-gray-400 text-sm mb-3">How are you feeling right now?</p>
              <div className="flex gap-3">
                {MOOD_OPTIONS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMoodBefore(m.value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                      moodBefore === m.value
                        ? 'border-indigo-500 bg-indigo-950/40'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <m.icon className={`w-5 h-5 ${m.color}`} />
                    <span className="text-xs text-gray-400">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-3">Choose your break type:</p>
              <div className="space-y-2">
                {BREAK_OPTIONS.map(opt => {
                  const Icon = opt.icon
                  const dur = BREAK_DURATIONS[opt.id]
                  const durLabel = dur >= 60 ? `${Math.round(dur/60)}min` : `${dur}s`
                  return (
                    <button
                      key={opt.id}
                      onClick={() => moodBefore && startBreak(opt.id, moodBefore)}
                      disabled={!moodBefore}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border bg-gradient-to-r ${
                        opt.bg
                      } ${
                        opt.border
                      } hover:scale-[1.01] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left`}
                    >
                      <div className="p-2 rounded-xl" style={{ backgroundColor: opt.color + '22' }}>
                        <Icon className="w-5 h-5" style={{ color: opt.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-white text-sm font-medium">{opt.label}</p>
                          <span className="text-xs text-gray-500">{durLabel}</span>
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{opt.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  )
                })}
              </div>
            </div>
            {!moodBefore && <p className="text-xs text-gray-600 text-center">Select your mood first to start a break</p>}
          </div>
        )}

        {/* Step 2: Active session */}
        {step === 'session' && option && (
          <div className="relative">
            {/* Nature background image */}
            {breakType === 'nature' && (
              <div
                className="h-52 bg-cover bg-center"
                style={{ backgroundImage: `url(${natureImg})` }}
              >
                <div className="h-full bg-black/30 flex items-center justify-center">
                  <p className="text-white text-lg font-medium drop-shadow">Let your mind wander freely...</p>
                </div>
              </div>
            )}

            {/* Breathing animation */}
            {breakType === 'breathing' && (
              <div className="h-52 flex flex-col items-center justify-center gap-3" style={{ background: 'linear-gradient(135deg, #0c1445 0%, #0f172a 100%)' }}>
                <div
                  className={`w-24 h-24 rounded-full border-4 transition-all duration-[4000ms] ease-in-out ${
                    BREATH_SCALE[breathPhase]
                  }`}
                  style={{ borderColor: '#3b82f6', backgroundColor: '#3b82f620' }}
                />
                <p className="text-blue-300 font-medium text-lg">{BREATH_LABELS[breathPhase]}</p>
                <p className="text-gray-500 text-xs">Cycle {breathCount + 1} · 4-4-4-4 box breathing</p>
              </div>
            )}

            {/* Binaural visual */}
            {breakType === 'binaural' && (
              <div className="h-52 flex flex-col items-center justify-center gap-3" style={{ background: 'linear-gradient(135deg, #1e0a45 0%, #0f172a 100%)' }}>
                <div className="flex gap-2 items-center">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-full animate-pulse"
                      style={{
                        backgroundColor: '#8b5cf6',
                        height: `${20 + Math.sin(i * 1.2) * 15}px`,
                        animationDelay: `${i * 0.2}s`,
                        animationDuration: '1.5s',
                      }}
                    />
                  ))}
                </div>
                <p className="text-purple-300 font-medium">Alpha waves · 10Hz</p>
                <p className="text-gray-500 text-xs">Use headphones for best effect</p>
              </div>
            )}

            {/* Timer + progress */}
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{option.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{option.science}</p>
                </div>
                <span
                  className="text-3xl font-mono font-bold"
                  style={{ color: option.color }}
                >
                  {mins}:{secs}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%`, backgroundColor: option.color }}
                />
              </div>
              <button
                onClick={handleSessionComplete}
                className="w-full py-2.5 text-gray-500 hover:text-white text-sm border border-gray-800 hover:border-gray-600 rounded-xl transition-colors"
              >
                End early
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Mood after */}
        {step === 'mood' && (
          <div className="p-5 space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">✨</div>
              <h3 className="text-white font-semibold">Break complete!</h3>
              <p className="text-gray-400 text-sm mt-1">How do you feel now?</p>
            </div>
            <div className="flex gap-3">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.value}
                  onClick={() => saveMood(m.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    moodAfter === m.value
                      ? 'border-indigo-500 bg-indigo-950/40'
                      : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                  <span className="text-xs text-gray-400">{m.label}</span>
                </button>
              ))}
            </div>
            {moodBefore && moodAfter && (
              <div className={`text-center text-sm rounded-xl p-3 ${
                moodAfter > moodBefore
                  ? 'bg-green-900/30 text-green-400 border border-green-800/40'
                  : moodAfter === moodBefore
                  ? 'bg-gray-800/50 text-gray-400'
                  : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/40'
              }`}>
                {moodAfter > moodBefore
                  ? `+${moodAfter - moodBefore} mood boost from your break 🎯`
                  : moodAfter === moodBefore
                  ? 'Mood stable — try a longer break next time'
                  : 'Try nature sounds or a longer session next time'}
              </div>
            )}
            <button
              onClick={handleClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
            >
              Back to Focus
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
