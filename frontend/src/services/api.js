import axios from 'axios'

// Prefer same-origin (Vite proxy) so Dev Tunnels / remote browsers work.
// Set VITE_API_URL only when the API is on a different public origin.
const configuredApiUrl = import.meta.env.VITE_API_URL
const api = axios.create({
  baseURL: configuredApiUrl || '',
  withCredentials: true,
})

export default api