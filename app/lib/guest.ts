// Clave para el ID de invitado en localStorage
const GUEST_ID_KEY = 'arca_guest_id'

// Obtener o crear ID de invitado
export function getOrCreateGuestId(): string {
  // Si no está en el navegador, devolver vacío (evitar errores en el servidor)
  if (typeof window === 'undefined') return ''
  
  // Verificar si ya existe
  let id = localStorage.getItem(GUEST_ID_KEY)
  
  // Si no existe, generar uno nuevo y guardarlo
  if (!id) {
    id = crypto.randomUUID()  // Generar UUID
    localStorage.setItem(GUEST_ID_KEY, id)
  }
  
  return id
}
