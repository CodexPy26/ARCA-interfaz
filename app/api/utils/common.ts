import type { NextRequest } from 'next/server'
import { ChatClient } from 'dify-client'
import { API_KEY, API_URL, APP_ID, APP_INFO } from '@/config'

export const getInfo = (request: NextRequest) => {
  const sessionId = request.cookies.get('session_id')?.value || ''
  return {
    sessionId,
    user: sessionId,
  }
}

export const setSession = (sessionId: string) => {
  if (APP_INFO.disable_session_same_site)
  { return { 'Set-Cookie': `session_id=${sessionId}; SameSite=None; Secure` } }

  return { 'Set-Cookie': `session_id=${sessionId}` }
}

export const client = new ChatClient(API_KEY, API_URL || undefined)
