import { TIER_CONFIG } from '../utils/passwordStrength'

export default function PasswordStrengthIndicator({ analysis }) {
  const { tier, score, entropy, checks, tips } = analysis

  if (!tier) return null

  const config = TIER_CONFIG[tier]

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 space-y-3 transition-all duration-300`}>

      {/* Header row — tier label, score, entropy */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Tier icon */}
          {tier === 'strong' && (
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
          {tier === 'moderate' && (
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          )}
          {tier === 'weak' && (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`font-semibold text-sm ${config.color}`}>{config.label}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>Score: <span className="text-zinc-300">{score}/100</span></span>
          <span>Entropy: <span className="text-zinc-300">{entropy} bits</span></span>
        </div>
      </div>

      {/* Strength bar */}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-1.5">
            {check.passed ? (
              <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-xs ${check.passed ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>

      {/* Tips - only shown for weak/moderate */}
      {tips.length > 0 && tier !== 'strong' && (
        <div className="border-t border-zinc-700/50 pt-3 space-y-1.5">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-amber-500 text-xs mt-0.5 shrink-0">→</span>
              <p className="text-xs text-zinc-400">{tip}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
