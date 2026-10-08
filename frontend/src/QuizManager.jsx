import { useEffect, useState } from 'react'
import api from './services/api'

const dimensions = [
  { key: 'acidity_weight', label: 'Acidez' },
  { key: 'bitterness_weight', label: 'Amargor' },
  { key: 'sweetness_weight', label: 'Doçura' },
]

function createOption() {
  return {
    text: '',
    acidity_weight: 5,
    bitterness_weight: 5,
    sweetness_weight: 5,
  }
}

function createQuestion() {
  return { text: '', sort_order: '', options: [createOption(), createOption()] }
}

function QuizManager() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [question, setQuestion] = useState(createQuestion)

  useEffect(() => {
    let isCurrent = true
    api.get('/quiz/admin/perguntas')
      .then(({ data }) => {
        if (isCurrent) setQuestions(data)
      })
      .catch((requestError) => {
        if (isCurrent) {
          setError(requestError.response?.data?.message || 'Não foi possível carregar as perguntas.')
        }
      })
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [])

  function updateOption(index, field, value) {
    setQuestion((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, [field]: value } : option
      )),
    }))
  }

  function startEditing(item) {
    setEditingId(item.id)
    setQuestion({
      text: item.text,
      sort_order: String(item.sort_order),
      options: item.options.map((option) => ({
        text: option.text,
        acidity_weight: option.acidity_weight,
        bitterness_weight: option.bitterness_weight,
        sweetness_weight: option.sweetness_weight,
      })),
    })
    setError('')
    setNotice('')
  }

  function resetEditor() {
    setEditingId(null)
    setQuestion(createQuestion())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    const payload = {
      text: question.text,
      ...(question.sort_order === '' ? {} : { sort_order: Number(question.sort_order) }),
      options: question.options.map((option) => ({
        ...option,
        acidity_weight: Number(option.acidity_weight),
        bitterness_weight: Number(option.bitterness_weight),
        sweetness_weight: Number(option.sweetness_weight),
      })),
    }

    try {
      if (editingId) {
        await api.put(`/quiz/admin/perguntas/${editingId}`, payload)
        setNotice('Pergunta atualizada com sucesso.')
      } else {
        await api.post('/quiz/admin/perguntas', payload)
        setNotice('Pergunta adicionada com sucesso.')
      }
      const { data } = await api.get('/quiz/admin/perguntas')
      setQuestions(data)
      resetEditor()
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível salvar a pergunta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Excluir a pergunta "${item.text}" e suas opções?`)) return

    setDeletingId(item.id)
    setError('')
    setNotice('')
    try {
      await api.delete(`/quiz/admin/perguntas/${item.id}`)
      setQuestions((current) => current.filter((entry) => entry.id !== item.id))
      if (editingId === item.id) resetEditor()
      setNotice('Pergunta excluída com sucesso.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Não foi possível excluir a pergunta.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="quiz-admin">
      <div className="page-heading catalog-heading">
        <div>
          <p className="eyebrow">TASTE FINDER</p>
          <h1>Perguntas do quiz</h1>
          <p className="page-description">Crie perguntas e defina como cada resposta compõe o perfil sensorial.</p>
        </div>
        <a className="submit-button quiz-preview-link" href="/quiz">Visualizar quiz</a>
      </div>

      {error && <p className="quiz-feedback feedback-error" role="alert">{error}</p>}
      {notice && <p className="quiz-feedback feedback-success" role="status">{notice}</p>}

      <div className="quiz-admin-layout">
        <section className="quiz-question-list" aria-label="Perguntas cadastradas">
          <h2>Perguntas cadastradas</h2>
          {loading ? (
            <p className="catalog-empty">Carregando perguntas...</p>
          ) : questions.length === 0 ? (
            <p className="catalog-empty">Nenhuma pergunta cadastrada.</p>
          ) : (
            <ol className="quiz-question-items">
              {questions.map((item, index) => (
                <li className="quiz-question-item" key={item.id}>
                  <div className="quiz-question-copy">
                    <span className="quiz-question-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{item.text}</strong>
                      <small>{item.options.length} opções · ordem {item.sort_order}</small>
                    </div>
                  </div>
                  <div className="quiz-question-actions">
                    <button className="text-action" type="button" onClick={() => startEditing(item)}>Editar</button>
                    <button
                      className="text-action text-action-delete"
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form className="quiz-editor" onSubmit={handleSubmit}>
          <div className="quiz-editor-heading">
            <h2>{editingId ? 'Editar pergunta' : 'Nova pergunta'}</h2>
            {editingId && <button className="text-action" type="button" onClick={resetEditor}>Cancelar edição</button>}
          </div>
          <label className="field">
            <span>Texto da pergunta <b>*</b></span>
            <textarea
              value={question.text}
              onChange={(event) => setQuestion((current) => ({ ...current, text: event.target.value }))}
              maxLength="300"
              rows="2"
              required
            />
          </label>
          <label className="field quiz-order-field">
            <span>Ordem de exibição</span>
            <input
              type="number"
              min="0"
              step="1"
              value={question.sort_order}
              onChange={(event) => setQuestion((current) => ({ ...current, sort_order: event.target.value }))}
              placeholder="Automática"
            />
          </label>

          <div className="quiz-options-heading">
            <div>
              <h3>Respostas e pesos</h3>
              <p>Use valores de 0 a 10 para cada característica.</p>
            </div>
            <button
              className="text-action"
              type="button"
              onClick={() => setQuestion((current) => ({ ...current, options: [...current.options, createOption()] }))}
              disabled={question.options.length >= 8}
            >
              + Adicionar opção
            </button>
          </div>

          <div className="quiz-option-editor-list">
            {question.options.map((option, index) => (
              <fieldset className="quiz-option-editor" key={index}>
                <legend>Opção {index + 1}</legend>
                {question.options.length > 2 && (
                  <button
                    className="quiz-option-remove"
                    type="button"
                    onClick={() => setQuestion((current) => ({
                      ...current,
                      options: current.options.filter((_, optionIndex) => optionIndex !== index),
                    }))}
                    aria-label={`Remover opção ${index + 1}`}
                  >
                    Remover
                  </button>
                )}
                <label className="field">
                  <span>Texto da resposta <b>*</b></span>
                  <input
                    value={option.text}
                    onChange={(event) => updateOption(index, 'text', event.target.value)}
                    maxLength="300"
                    required
                  />
                </label>
                <div className="quiz-weight-grid">
                  {dimensions.map(({ key, label }) => (
                    <label className="field" key={key}>
                      <span>{label} <b>*</b></span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="1"
                        value={option[key]}
                        onChange={(event) => updateOption(index, key, event.target.value)}
                        required
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <footer className="quiz-editor-footer">
            <button className="submit-button" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar pergunta' : 'Adicionar pergunta'}
            </button>
          </footer>
        </form>
      </div>
    </section>
  )
}

export default QuizManager
