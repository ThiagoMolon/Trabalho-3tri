import { useEffect, useState } from 'react'
import api from './services/api'

const dimensions = [
  { key: 'acidity', label: 'Acidez' },
  { key: 'bitterness', label: 'Amargor' },
  { key: 'sweetness', label: 'Doçura' },
]

function describeProfile(profile) {
  const descriptions = []
  if (profile.acidity >= 7) descriptions.push('cafés vibrantes e frutados')
  else if (profile.acidity <= 3) descriptions.push('cafés de acidez suave')
  else descriptions.push('cafés de acidez equilibrada')

  if (profile.bitterness >= 7) descriptions.push('amargor marcante')
  else if (profile.bitterness <= 3) descriptions.push('finalização mais leve')
  else descriptions.push('amargor moderado')

  if (profile.sweetness >= 7) descriptions.push('notas naturalmente doces')
  else if (profile.sweetness <= 3) descriptions.push('doçura discreta')
  else descriptions.push('doçura equilibrada')

  return `Seu paladar combina ${descriptions.join(', ')}.`
}

function TasteFinder() {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    api.get('/quiz/perguntas')
      .then(({ data }) => {
        if (isCurrent) setQuestions(data)
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Não foi possível carregar o Taste Finder.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  async function continueQuiz() {
    const selectedOptionId = answers[questions[currentIndex]?.id]
    if (!selectedOptionId) return
    setError('')

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1)
      return
    }

    setSubmitting(true)
    try {
      const optionIds = questions.map((question) => answers[question.id])
      const { data } = await api.post('/quiz/resultado', { option_ids: optionIds })
      setProfile(data.profile)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível calcular seu perfil.')
    } finally {
      setSubmitting(false)
    }
  }

  function restart() {
    setAnswers({})
    setCurrentIndex(0)
    setProfile(null)
    setError('')
  }

  const currentQuestion = questions[currentIndex]
  const progress = profile ? 100 : questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0

  return (
    <main className="taste-page">
      <header className="taste-header">
        <a className="taste-brand" href="/" aria-label="Origin Beans">
          <span className="taste-brand-mark">OB</span>
          <span>origin<span>beans</span></span>
        </a>
        <a className="taste-admin-link" href="/login">Entrar na conta</a>
      </header>

      <section className="taste-main">
        <div className="taste-intro">
          <p className="eyebrow">ORIGIN &amp; BEANS · TASTE FINDER</p>
          <h1>Descubra seu perfil de café</h1>
          <p>Responda algumas perguntas rápidas e encontre o equilíbrio de sabores que combina com você.</p>
        </div>

        {loading ? (
          <div className="taste-card"><p className="catalog-empty">Preparando seu quiz...</p></div>
        ) : error && questions.length === 0 ? (
          <div className="taste-card"><p className="feedback-error" role="alert">{error}</p></div>
        ) : questions.length === 0 ? (
          <div className="taste-card">
            <p className="taste-empty-title">O quiz ainda não está disponível</p>
            <p className="taste-empty-copy">Volte em breve para descobrir seu perfil sensorial.</p>
          </div>
        ) : profile ? (
          <section className="taste-card taste-result" aria-live="polite">
            <span className="taste-result-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">SEU PERFIL SENSORIAL</p>
            <h2>Um café com a sua personalidade</h2>
            <p className="taste-result-description">{describeProfile(profile)}</p>
            <div className="taste-profile-bars">
              {dimensions.map(({ key, label }) => (
                <div className="taste-profile-row" key={key}>
                  <div className="taste-profile-label">
                    <span>{label}</span>
                    <strong>{profile[key]}/10</strong>
                  </div>
                  <div
                    className="taste-profile-track"
                    role="meter"
                    aria-label={label}
                    aria-valuemin="0"
                    aria-valuemax="10"
                    aria-valuenow={profile[key]}
                  >
                    <span style={{ width: `${profile[key] * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="taste-privacy-note">Este resultado é exibido apenas nesta sessão e ainda não fica salvo em uma conta.</p>
            <button className="taste-primary-button" type="button" onClick={restart}>Refazer quiz</button>
          </section>
        ) : (
          <section className="taste-card" aria-labelledby="taste-question-title">
            <div className="taste-progress-copy">
              <span>Pergunta {currentIndex + 1} de {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="taste-progress-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
            <div className="taste-question-content">
              <h2 id="taste-question-title">{currentQuestion.text}</h2>
              <div className="taste-answer-list">
                {currentQuestion.options.map((option) => (
                  <label
                    className={`taste-answer ${answers[currentQuestion.id] === option.id ? 'taste-answer-selected' : ''}`}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option.id}
                      checked={answers[currentQuestion.id] === option.id}
                      onChange={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: option.id }))}
                    />
                    <span className="taste-answer-radio" aria-hidden="true" />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
              {error && <p className="feedback-error" role="alert">{error}</p>}
              <div className="taste-navigation">
                <button
                  className="taste-back-button"
                  type="button"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0 || submitting}
                >
                  Voltar
                </button>
                <button
                  className="taste-primary-button"
                  type="button"
                  onClick={continueQuiz}
                  disabled={!answers[currentQuestion.id] || submitting}
                >
                  {submitting ? 'Calculando...' : currentIndex === questions.length - 1 ? 'Ver meu perfil' : 'Continuar'}
                </button>
              </div>
            </div>
          </section>
        )}
      </section>

      <footer className="taste-footer">Origin &amp; Beans · Café com origem e personalidade</footer>
    </main>
  )
}

export default TasteFinder
