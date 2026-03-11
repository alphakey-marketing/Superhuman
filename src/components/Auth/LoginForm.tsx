import { useState } from 'react'
import { Brain, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)
    const error = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)
    setLoading(false)
    if (error) setMessage(error.message)
    else if (isSignUp) setMessage('Check your email to confirm your account.')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="p-3 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white font-bold text-2xl">AttentionOS</h1>
          <p className="text-gray-400 text-sm mt-1">Train, plan and restore your focus</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-xl">
          <h2 className="text-white font-semibold text-lg mb-6">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600"
                required
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-800 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {message && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                message.includes('Check')
                  ? 'bg-green-900/30 text-green-400 border border-green-800'
                  : 'bg-red-900/30 text-red-400 border border-red-800'
              }`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-medium transition-colors mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            className="text-indigo-400 ml-1.5 hover:text-indigo-300 transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
