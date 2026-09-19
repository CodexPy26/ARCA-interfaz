import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getInfo, setSession } from '@/app/api/utils/common'

export async function GET(request: NextRequest) {
  const { sessionId, user: fallbackUser } = getInfo(request)
  const { searchParams } = new URL(request.url)
  const user = searchParams.get('user') || fallbackUser
  try {
    const { data }: any = await client.getConversations(user)
    return NextResponse.json(data, {
      headers: setSession(sessionId),
    })
  }
  catch (error: any) {
    return NextResponse.json({
      data: [],
      error: error.message,
    })
  }
}
export async function PATCH(request: NextRequest) {
  const { sessionId, user: fallbackUser } = getInfo(request)
  const { searchParams } = new URL(request.url)
  const user = searchParams.get('user') || fallbackUser

  try {
    const body = await request.json()
    const { id, name } = body

    // ⚠️ esto depende de cómo funcione tu client
    const { data }: any = await client.updateConversation(user, id, {
      name,
    })

    return NextResponse.json(data, {
      headers: setSession(sessionId),
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    })
  }
}
