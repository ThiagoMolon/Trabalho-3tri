import { useEffect, useState } from 'react'
import api from './api'

export default function usePublicData(path, fallbackMessage) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get(path)
      .then(({ data: result }) => {
        if (active) setData(result)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || fallbackMessage)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [path, fallbackMessage])

  return { data, loading, error }
}
