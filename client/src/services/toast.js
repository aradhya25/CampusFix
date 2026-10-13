export function notifyToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('campusfix:toast', { detail: { message, type } }))
}
