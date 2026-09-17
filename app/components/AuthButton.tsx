'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AuthButton() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const supabase = createClient()

  // Verificar estado de inicio de sesión al cargar la página
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
  }, [])

  // Manejar inicio de sesión/registro
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (mode === 'signup') {
      // Registro
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return setMsg(error.message)
      
      // Insertar respaldo en profiles (en caso de que el trigger falle)
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          plan: 'free',
          queries_limit: 20,
        })
      }
      setMsg('¡Registro exitoso! Revisa tu correo para confirmar.')
    } else {
      // Inicio de sesión
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return setMsg(error.message)
      setOpen(false)
    }
  }

  if (loading) return <span className="text-sm text-gray-400">...</span>

  // Mostrar correo y botón de cerrar sesión cuando ya inició sesión
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">{user.email}</span>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            setUser(null)
          }}
          className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  // Mostrar botón de inicio de sesión cuando no ha iniciado sesión
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
      >
        Iniciar sesión / Registrarse
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                placeholder="Contraseña (al menos 6 dígitos)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded bg-black py-2 text-sm text-white hover:bg-gray-800"
              >
                {mode === 'login' ? 'Iniciar sesión' : 'Registrarse'}
              </button>
            </form>

            {msg && <p className="mt-3 text-xs text-gray-600">{msg}</p>}

            <div className="mt-4 flex justify-between text-xs">
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-blue-600 hover:underline"
              >
                {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:underline"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
