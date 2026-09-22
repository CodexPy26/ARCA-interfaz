import type { NextRequest } from 'next/server'
import { API_KEY, API_URL } from '@/config'
import { getInfo } from '@/app/api/utils/common'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
  
export async function POST(request: NextRequest) {
  const body = await request.json()
  const {
    inputs,
    query,
    files,
    conversation_id: conversationId,
    response_mode: responseMode,
    user: bodyUser, //NUEVO:extraer user del body
  } = body
  const { user: fallbackUser } = getInfo(request)
  const user = bodyUser || fallbackUser // nuevo: priorizar body
  const payload = {
  inputs,
  query,
  user,
  response_mode: responseMode,
  conversation_id: conversationId,
  files,
}

  const difyRes = await fetch(`${API_URL}/chat-messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  
  if (!difyRes.ok) {
    const errorText = await difyRes.text()
    return new Response(errorText, { status: difyRes.status })
  }
  
  return new Response(difyRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
