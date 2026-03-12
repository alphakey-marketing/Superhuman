import { IS_UAT } from '../types'

/**
 * Shows a visible warning banner when running in UAT mode.
 * Disappears automatically in production (VITE_UAT_MODE != 'true').
 */
export default function UATBanner() {
  if (!IS_UAT) return null

  return (
    <div className="w-full bg-yellow-500 text-gray-950 text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2 z-50">
      <span>⚡ UAT MODE</span>
      <span className="opacity-60">|</span>
      <span>Focus: 10s · Short Break: 5s · Long Break: 8s</span>
      <span className="opacity-60">|</span>
      <span>Set <code className="font-mono bg-yellow-400/50 px-1 rounded">VITE_UAT_MODE=false</code> to switch to production timings</span>
    </div>
  )
}
