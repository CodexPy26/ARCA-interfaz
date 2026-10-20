import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Clonamos los headers
  const requestHeaders = new Headers(request.headers)
  const acceptLanguage = requestHeaders.get('accept-language') || ''
  
  // 2. Saneamos SIEMPRE (no solo si contiene *, también si está vacío o es inválido)
  //    Esto asegura que Dify nunca reciba un valor que rompa Intl.getCanonicalLocales
  if (!acceptLanguage || acceptLanguage.includes('*') || !/^[a-zA-Z]/.test(acceptLanguage)) {
    requestHeaders.set('accept-language', 'es-419,es;q=0.9,en;q=0.8')
  }

  // 3. Pasamos los headers saneados a la respuesta
  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // 4. Tu lógica de Supabase (sin cambios)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
