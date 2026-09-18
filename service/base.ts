import { API_PREFIX } from '@/config'
import Toast from '@/app/components/base/toast'
import type { AnnotationReply, MessageEnd, MessageReplace, ThoughtItem } from '@/app/components/chat/type'
import type { VisionFile } from '@/types/app'
import { createClient } from '@/app/lib/supabase/client'


const TIME_OUT = 100000

// ⭐ Obtener un ID de usuario (autenticado o invitado)
let cachedUserId: string | null = null
let cachedIsAuthenticated = false

async function getUserId(): Promise<string> {
  if (typeof window === 'undefined') return 'anonymous'

  try {
    // Siempre consultar Supabase (no cachear el resultado de auth)
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()

    if (data.user?.id) {
      cachedUserId = data.user.id
      cachedIsAuthenticated = true
      return cachedUserId
    }
  } catch (e) {
    // Si falla, seguimos con el guestId
  }

  // Si ya tenemos un guestId cacheado, devolverlo
  if (cachedUserId && !cachedIsAuthenticated) return cachedUserId

  // Si no, leer o crear el guestId
  let guestId = localStorage.getItem('arca_guest_id')
  if (!guestId) {
    guestId = crypto.randomUUID()
    localStorage.setItem('arca_guest_id', guestId)
  }
  cachedUserId = guestId
  cachedIsAuthenticated = false
  return cachedUserId
}

const ContentType = {
  json: 'application/json',
  stream: 'text/event-stream',
  form: 'application/x-www-form-urlencoded; charset=UTF-8',
  download: 'application/octet-stream', // for download
}

const baseOptions = {
  method: 'GET',
  mode: 'cors',
  credentials: 'include', // always send cookies、HTTP Basic authentication.
  headers: new Headers({
    'Content-Type': ContentType.json,
  }),
  redirect: 'follow',
}

export interface WorkflowStartedResponse {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    sequence_number: number
    created_at: number
  }
}

export interface WorkflowFinishedResponse {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    workflow_id: string
    status: string
    outputs: any
    error: string
    elapsed_time: number
    total_tokens: number
    total_steps: number
    created_at: number
    finished_at: number
  }
}

export interface NodeStartedResponse {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    created_at: number
    extras?: any
  }
}

export interface NodeFinishedResponse {
  task_id: string
  workflow_run_id: string
  event: string
  data: {
    id: string
    node_id: string
    node_type: string
    index: number
    predecessor_node_id?: string
    inputs: any
    process_data: any
    outputs: any
    status: string
    error: string
    elapsed_time: number
    execution_metadata: {
      total_tokens: number
      total_price: number
      currency: string
    }
    created_at: number
  }
}

export interface IOnDataMoreInfo {
  conversationId?: string
  taskId?: string
  messageId: string
  errorMessage?: string
  errorCode?: string
}

export type IOnData = (message: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => void
export type IOnThought = (though: ThoughtItem) => void
export type IOnFile = (file: VisionFile) => void
export type IOnMessageEnd = (messageEnd: MessageEnd) => void
export type IOnMessageReplace = (messageReplace: MessageReplace) => void
export type IOnAnnotationReply = (messageReplace: AnnotationReply) => void
export type IOnCompleted = (hasError?: boolean) => void
export type IOnError = (msg: string, code?: string) => void
export type IOnWorkflowStarted = (workflowStarted: WorkflowStartedResponse) => void
export type IOnWorkflowFinished = (workflowFinished: WorkflowFinishedResponse) => void
export type IOnNodeStarted = (nodeStarted: NodeStartedResponse) => void
export type IOnNodeFinished = (nodeFinished: NodeFinishedResponse) => void

interface IOtherOptions {
  isPublicAPI?: boolean
  bodyStringify?: boolean
  needAllResponseContent?: boolean
  deleteContentType?: boolean
  onData?: IOnData // for stream
  onThought?: IOnThought
  onFile?: IOnFile
  onMessageEnd?: IOnMessageEnd
  onMessageReplace?: IOnMessageReplace
  onError?: IOnError
  onCompleted?: IOnCompleted // for stream
  getAbortController?: (abortController: AbortController) => void
  onWorkflowStarted?: IOnWorkflowStarted
  onWorkflowFinished?: IOnWorkflowFinished
  onNodeStarted?: IOnNodeStarted
  onNodeFinished?: IOnNodeFinished
}

function unicodeToChar(text: string) {
  return text.replace(/\\u[0-9a-f]{4}/g, (_match, p1) => {
    return String.fromCharCode(parseInt(p1, 16))
  })
}

const handleStream = (
  response: Response,
  onData: IOnData,
  onCompleted?: IOnCompleted,
  onThought?: IOnThought,
  onMessageEnd?: IOnMessageEnd,
  onMessageReplace?: IOnMessageReplace,
  onFile?: IOnFile,
  onWorkflowStarted?: IOnWorkflowStarted,
  onWorkflowFinished?: IOnWorkflowFinished,
  onNodeStarted?: IOnNodeStarted,
  onNodeFinished?: IOnNodeFinished,
) => {
  if (!response.ok) {
    onCompleted?.(true)
    throw new Error('Network response was not ok')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let bufferObj: Record<string, any>
  let isFirstMessage = true

  function read() {
    reader?.read().then((result: any) => {
      if (result.done) {
        // Si al cerrar el stream quedó algo pendiente en el buffer, procesarlo
        if (buffer && buffer.trim().startsWith('data: ')) {
          try {
            const lastObj = JSON.parse(buffer.trim().substring(6)) as Record<string, any>
            if (lastObj.event === 'message_end') onMessageEnd?.(lastObj as MessageEnd)
            if (lastObj.event === 'workflow_finished') onWorkflowFinished?.(lastObj as WorkflowFinishedResponse)
          } catch (e) {
            // ignorar error de parseo final
          }
        }
        // SIEMPRE marcar como completado al terminar la lectura del stream
        onCompleted?.()
        return
      }

      buffer += decoder.decode(result.value, { stream: true })
      const lines = buffer.split('\n')

      // Procesar todas las líneas completas excepto la última (que puede estar fragmentada)
      for (let i = 0; i < lines.length - 1; i++) {
        const message = lines[i].trim()
        if (message.startsWith('data: ')) {
          try {
            bufferObj = JSON.parse(message.substring(6)) as Record<string, any>
          } catch (e) {
            onData('', isFirstMessage, {
              conversationId: bufferObj?.conversation_id,
              messageId: bufferObj?.message_id,
            })
            continue
          }

          if (bufferObj.status === 400 || !bufferObj.event) {
            onData('', false, {
              conversationId: undefined,
              messageId: '',
              errorMessage: bufferObj?.message,
              errorCode: bufferObj?.code,
            })
            onCompleted?.(true)
            return
          }

          if (bufferObj.event === 'message' || bufferObj.event === 'agent_message') {
            onData(unicodeToChar(bufferObj.answer), isFirstMessage, {
              conversationId: bufferObj.conversation_id,
              taskId: bufferObj.task_id,
              messageId: bufferObj.id,
            })
            isFirstMessage = false
          }
          else if (bufferObj.event === 'agent_thought') {
            onThought?.(bufferObj as ThoughtItem)
          }
          else if (bufferObj.event === 'message_file') {
            onFile?.(bufferObj as VisionFile)
          }
          else if (bufferObj.event === 'message_end') {
            onMessageEnd?.(bufferObj as MessageEnd)
          }
          else if (bufferObj.event === 'message_replace') {
            onMessageReplace?.(bufferObj as MessageReplace)
          }
          else if (bufferObj.event === 'workflow_started') {
            onWorkflowStarted?.(bufferObj as WorkflowStartedResponse)
          }
          else if (bufferObj.event === 'workflow_finished') {
            onWorkflowFinished?.(bufferObj as WorkflowFinishedResponse)
          }
          else if (bufferObj.event === 'node_started') {
            onNodeStarted?.(bufferObj as NodeStartedResponse)
          }
          else if (bufferObj.event === 'node_finished') {
            onNodeFinished?.(bufferObj as NodeFinishedResponse)
          }
        }
      }

      // Guardar el remanente incompleto en el buffer
      buffer = lines[lines.length - 1]

      // Seguir leyendo el siguiente chunk
      read()
    }).catch((err) => {
      // Si la conexión se corta o falla, forzar el desbloqueo de la interfaz
      console.error('Stream reading error:', err)
      onCompleted?.(true)
    })
  }

  read()
}
const baseFetch = async (url: string, fetchOptions: any, { needAllResponseContent }: IOtherOptions) => {
  const options = Object.assign({}, baseOptions, fetchOptions)

  const urlPrefix = API_PREFIX

  let urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  const { method, params, body } = options

  const userId = await getUserId()

  // handle query
  if (method === 'GET') {
    // Agregar user como parámetro de query
    if (!options.params) {
      options.params = { user: userId }
    } else if (!options.params.user) {
      options.params.user = userId
    }

    const paramsArray: string[] = []
    Object.keys(options.params).forEach(key =>
      paramsArray.push(`${key}=${encodeURIComponent(options.params[key])}`),
    )
    if (urlWithPrefix.search(/\?/) === -1) { urlWithPrefix += `?${paramsArray.join('&')}` }

    else { urlWithPrefix += `&${paramsArray.join('&')}` }

    delete options.params
  }

  if (body) {
    options.body = JSON.stringify({ ...body, user: userId })
  } else if (method === 'POST' || method === 'PUT') {
    options.body = JSON.stringify({ user: userId })
  }

  // Handle timeout
  return Promise.race([
    new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('request timeout'))
      }, TIME_OUT)
    }),
    new Promise((resolve, reject) => {
      globalThis.fetch(urlWithPrefix, options)
        .then((res: any) => {
          const resClone = res.clone()
          // Error handler
          if (!/^(2|3)\d{2}$/.test(res.status)) {
            try {
              const bodyJson = res.json()
              switch (res.status) {
                case 401: {
                  Toast.notify({ type: 'error', message: 'Invalid token' })
                  return
                }
                default:
                  // eslint-disable-next-line no-new
                  new Promise(() => {
                    bodyJson.then((data: any) => {
                      Toast.notify({ type: 'error', message: data.message })
                    })
                  })
              }
            }
            catch (e) {
              Toast.notify({ type: 'error', message: `${e}` })
            }

            return Promise.reject(resClone)
          }

          // handle delete api. Delete api not return content.
          if (res.status === 204) {
            resolve({ result: 'success' })
            return
          }

          // return data
          const data = options.headers.get('Content-type') === ContentType.download ? res.blob() : res.json()

          resolve(needAllResponseContent ? resClone : data)
        })
        .catch((err) => {
          Toast.notify({ type: 'error', message: err })
          reject(err)
        })
    }),
  ])
}

export const upload = (fetchOptions: any): Promise<any> => {
  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}/file-upload`
  const defaultOptions = {
    method: 'POST',
    url: `${urlWithPrefix}`,
    data: {},
  }
  const options = {
    ...defaultOptions,
    ...fetchOptions,
  }
  return new Promise((resolve, reject) => {
    const xhr = options.xhr
    xhr.open(options.method, options.url)
    for (const key in options.headers) { xhr.setRequestHeader(key, options.headers[key]) }

    xhr.withCredentials = true
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) { resolve({ id: xhr.response }) }
        else { reject(xhr) }
      }
    }
    xhr.upload.onprogress = options.onprogress
    xhr.send(options.data)
  })
}

export const ssePost = async (
  url: string,
  fetchOptions: any,
  {
    onData,
    onCompleted,
    onThought,
    onFile,
    onMessageEnd,
    onMessageReplace,
    onWorkflowStarted,
    onWorkflowFinished,
    onNodeStarted,
    onNodeFinished,
    onError,
  }: IOtherOptions,
) => {
  const options = Object.assign({}, baseOptions, {
    method: 'POST',
  }, fetchOptions)

  const urlPrefix = API_PREFIX
  const urlWithPrefix = `${urlPrefix}${url.startsWith('/') ? url : `/${url}`}`

  // inyectar el user ID en el body
  const userId = await getUserId()
  if (options.body) {
    options.body.user = userId
  } else {
    options.body = { user: userId }
  }
  
  const { body } = options
  if (body) { options.body = JSON.stringify(body) }

  globalThis.fetch(urlWithPrefix, options)
    .then((res: any) => {
      if (!/^(2|3)\d{2}$/.test(res.status)) {
        // eslint-disable-next-line no-new
        new Promise(() => {
          res.json().then((data: any) => {
            Toast.notify({ type: 'error', message: data.message || 'Server Error' })
          })
        })
        onError?.('Server Error')
        return
      }
      return handleStream(res, (str: string, isFirstMessage: boolean, moreInfo: IOnDataMoreInfo) => {
        if (moreInfo.errorMessage) {
          Toast.notify({ type: 'error', message: moreInfo.errorMessage })
          return
        }
        onData?.(str, isFirstMessage, moreInfo)
      }, () => {
        onCompleted?.()
      }, onThought, onMessageEnd, onMessageReplace, onFile, onWorkflowStarted, onWorkflowFinished, onNodeStarted, onNodeFinished)
    })
    .catch((e) => {
      Toast.notify({ type: 'error', message: e })
      onError?.(e)
    })
}

export const request = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return baseFetch(url, options, otherOptions || {})
}

export const get = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'GET' }), otherOptions)
}

export const post = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'POST' }), otherOptions)
}

export const put = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'PUT' }), otherOptions)
}

export const del = (url: string, options = {}, otherOptions?: IOtherOptions) => {
  return request(url, Object.assign({}, options, { method: 'DELETE' }), otherOptions)
}
