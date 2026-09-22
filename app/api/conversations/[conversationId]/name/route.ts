import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getInfo } from '@/app/api/utils/common'

export async function POST(request: NextRequest, { params }: {
  params: Promise<{ conversationId: string }>
}) {
  const body = await request.json()
  const {
    auto_generate,
    name,
    user: bodyUser
  } = body
  const { conversationId } = await params
  const { user: fallbackUser } = getInfo(request)
  const user = bodyUser || fallbackUser

  // auto generate name
  const { data } = await client.renameConversation(conversationId, name, user, auto_generate)
  return NextResponse.json(data)
}
