import type { NextRequest } from 'next/server'
import { client, getInfo } from '@/app/api/utils/common'

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
  const res = await client.createChatMessage(inputs, query, user, responseMode, conversationId, files)
  return new Response(res.data as any, {
    headers: {
      'Content-type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}
