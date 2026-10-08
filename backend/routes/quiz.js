const express = require('express')

const dimensions = ['acidity', 'bitterness', 'sweetness']

function validationError(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

function readQuestion(body = {}) {
  const { text, sort_order, options } = body
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 300) {
    throw validationError('Informe uma pergunta com até 300 caracteres.')
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
    throw validationError('Cada pergunta deve ter de 2 a 8 opções.')
  }

  const order = sort_order === undefined ? null : Number(sort_order)
  if (order !== null && (!Number.isInteger(order) || order < 0)) {
    throw validationError('A ordem deve ser um número inteiro igual ou maior que zero.')
  }

  const normalizedOptions = options.map((option) => {
    if (typeof option?.text !== 'string' || !option.text.trim() || option.text.trim().length > 300) {
      throw validationError('Todas as opções devem ter um texto com até 300 caracteres.')
    }

    const weights = dimensions.map((dimension) => Number(option[`${dimension}_weight`] ?? 0))
    if (weights.some((weight) => !Number.isInteger(weight) || weight < 0 || weight > 10)) {
      throw validationError('Os pesos de acidez, amargor e doçura devem ser inteiros entre 0 e 10.')
    }

    return { text: option.text.trim(), weights }
  })

  return { text: text.trim(), sortOrder: order, options: normalizedOptions }
}

function readId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw validationError('Identificador inválido.')
  return id
}

function sendError(res, error, fallbackMessage) {
  if (error.statusCode) return res.status(error.statusCode).json({ message: error.message })
  console.error(fallbackMessage, error.message)
  return res.status(500).json({ message: fallbackMessage })
}

function createQuizRouter(pool, requireAuth, requireAdmin) {
  const router = express.Router()

  router.use('/admin', requireAuth, requireAdmin)

  router.get('/perguntas', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT question.id, question.text, question.sort_order,
          COALESCE(json_agg(json_build_object('id', option.id, 'text', option.text)
            ORDER BY option.id) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options
        FROM quiz_questions AS question
        LEFT JOIN quiz_options AS option ON option.question_id = question.id
        GROUP BY question.id
        ORDER BY question.sort_order ASC, question.id ASC
      `)
      return res.json(result.rows)
    } catch (error) {
      return sendError(res, error, 'Não foi possível carregar as perguntas do quiz.')
    }
  })

  router.get('/admin/perguntas', async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT question.id, question.text, question.sort_order,
          COALESCE(json_agg(json_build_object(
            'id', option.id,
            'text', option.text,
            'acidity_weight', option.acidity_weight,
            'bitterness_weight', option.bitterness_weight,
            'sweetness_weight', option.sweetness_weight
          ) ORDER BY option.id) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options
        FROM quiz_questions AS question
        LEFT JOIN quiz_options AS option ON option.question_id = question.id
        GROUP BY question.id
        ORDER BY question.sort_order ASC, question.id ASC
      `)
      return res.json(result.rows)
    } catch (error) {
      return sendError(res, error, 'Não foi possível carregar as perguntas do quiz.')
    }
  })

  router.post('/admin/perguntas', async (req, res) => {
    let question
    try {
      question = readQuestion(req.body)
    } catch (error) {
      return sendError(res, error, 'Não foi possível salvar a pergunta.')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const sortOrder = question.sortOrder === null
        ? (await client.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM quiz_questions')).rows[0].next_order
        : question.sortOrder
      const inserted = await client.query(
        'INSERT INTO quiz_questions (text, sort_order) VALUES ($1, $2) RETURNING id',
        [question.text, sortOrder],
      )
      const questionId = inserted.rows[0].id
      for (const option of question.options) {
        await client.query(
          `INSERT INTO quiz_options (
            question_id, text, acidity_weight, bitterness_weight, sweetness_weight
          ) VALUES ($1, $2, $3, $4, $5)`,
          [questionId, option.text, ...option.weights],
        )
      }
      await client.query('COMMIT')
      return res.status(201).json({ id: questionId, text: question.text, sort_order: sortOrder })
    } catch (error) {
      await client.query('ROLLBACK')
      return sendError(res, error, 'Não foi possível salvar a pergunta.')
    } finally {
      client.release()
    }
  })

  router.put('/admin/perguntas/:id', async (req, res) => {
    let question
    let id
    try {
      id = readId(req.params.id)
      question = readQuestion(req.body)
    } catch (error) {
      return sendError(res, error, 'Não foi possível atualizar a pergunta.')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const sortOrder = question.sortOrder === null
        ? (await client.query('SELECT sort_order FROM quiz_questions WHERE id = $1', [id])).rows[0]?.sort_order
        : question.sortOrder
      if (sortOrder === undefined) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Pergunta não encontrada.' })
      }

      const updated = await client.query(
        'UPDATE quiz_questions SET text = $1, sort_order = $2 WHERE id = $3',
        [question.text, sortOrder, id],
      )
      if (updated.rowCount === 0) {
        await client.query('ROLLBACK')
        return res.status(404).json({ message: 'Pergunta não encontrada.' })
      }
      await client.query('DELETE FROM quiz_options WHERE question_id = $1', [id])
      for (const option of question.options) {
        await client.query(
          `INSERT INTO quiz_options (
            question_id, text, acidity_weight, bitterness_weight, sweetness_weight
          ) VALUES ($1, $2, $3, $4, $5)`,
          [id, option.text, ...option.weights],
        )
      }
      await client.query('COMMIT')
      return res.json({ id, text: question.text, sort_order: sortOrder })
    } catch (error) {
      await client.query('ROLLBACK')
      return sendError(res, error, 'Não foi possível atualizar a pergunta.')
    } finally {
      client.release()
    }
  })

  router.delete('/admin/perguntas/:id', async (req, res) => {
    let id
    try {
      id = readId(req.params.id)
    } catch (error) {
      return sendError(res, error, 'Não foi possível excluir a pergunta.')
    }

    try {
      const result = await pool.query('DELETE FROM quiz_questions WHERE id = $1 RETURNING id', [id])
      if (result.rowCount === 0) return res.status(404).json({ message: 'Pergunta não encontrada.' })
      return res.status(204).end()
    } catch (error) {
      return sendError(res, error, 'Não foi possível excluir a pergunta.')
    }
  })

  router.post('/resultado', async (req, res) => {
    const optionIds = req.body?.option_ids
    if (!Array.isArray(optionIds) || optionIds.length < 1 || optionIds.length > 50
      || optionIds.some((id) => !Number.isInteger(id) || id < 1)
      || new Set(optionIds).size !== optionIds.length) {
      return res.status(400).json({ message: 'Envie uma opção válida para cada pergunta respondida.' })
    }

    try {
      const result = await pool.query(
        `SELECT question_id, acidity_weight, bitterness_weight, sweetness_weight
         FROM quiz_options WHERE id = ANY($1::int[])`,
        [optionIds],
      )
      const answers = result.rows
      if (answers.length !== optionIds.length
        || new Set(answers.map((answer) => answer.question_id)).size !== answers.length) {
        return res.status(400).json({ message: 'As respostas do quiz são inválidas.' })
      }

      const profile = Object.fromEntries(dimensions.map((dimension) => [
        dimension,
        Math.round(
          answers.reduce((total, answer) => total + Number(answer[`${dimension}_weight`]), 0)
          / answers.length * 10,
        ) / 10,
      ]))
      return res.json({ profile })
    } catch (error) {
      return sendError(res, error, 'Não foi possível calcular o resultado do quiz.')
    }
  })

  return router
}

module.exports = createQuizRouter
