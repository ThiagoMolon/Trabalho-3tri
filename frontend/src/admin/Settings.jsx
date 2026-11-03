import { useState } from 'react'
import { PageHeading } from './shared'
import { defaultSettings } from './mockData'

function Settings() {
  const [store, setStore] = useState(defaultSettings.store)
  const [shipping, setShipping] = useState(defaultSettings.shipping)
  const [payments, setPayments] = useState(defaultSettings.payments)
  const [notice, setNotice] = useState('')

  function handleTest() {
    setNotice('Teste executado: conexões de loja, envio e gateway verificadas (simulado).')
  }

  function handleSave(event) {
    event.preventDefault()
    setNotice('Configurações salvas localmente. Persistência na API em breve.')
  }

  return (
    <>
      <PageHeading
        eyebrow="SISTEMA"
        title="Configurações"
        description="Loja, envio, gateway de pagamento e equipe administrativa."
        actions={(
          <button className="ghost-button" type="button" onClick={handleTest}>
            Teste
          </button>
        )}
      />

      {notice && <p className="catalog-feedback feedback-success settings-notice" role="status">{notice}</p>}

      <form className="settings-grid" onSubmit={handleSave}>
        <section className="settings-card">
          <h2>Loja</h2>
          <p className="settings-card-copy">Dados públicos de contato da operação.</p>
          <label className="field">
            <span>Nome</span>
            <input value={store.name} onChange={(event) => setStore((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" value={store.email} onChange={(event) => setStore((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label className="field">
            <span>Telefone</span>
            <input value={store.phone} onChange={(event) => setStore((current) => ({ ...current, phone: event.target.value }))} />
          </label>
        </section>

        <section className="settings-card">
          <h2>Envio</h2>
          <p className="settings-card-copy">CEP de origem e serviços dos Correios.</p>
          <label className="field">
            <span>CEP de origem</span>
            <input value={shipping.originCep} onChange={(event) => setShipping((current) => ({ ...current, originCep: event.target.value }))} required />
          </label>
          <label className="active-toggle settings-toggle">
            <input type="checkbox" checked={shipping.pac} onChange={(event) => setShipping((current) => ({ ...current, pac: event.target.checked }))} />
            <span className="toggle-copy"><strong>PAC</strong><small>Serviço econômico ativo</small></span>
          </label>
          <label className="active-toggle settings-toggle">
            <input type="checkbox" checked={shipping.sedex} onChange={(event) => setShipping((current) => ({ ...current, sedex: event.target.checked }))} />
            <span className="toggle-copy"><strong>SEDEX</strong><small>Serviço expresso ativo</small></span>
          </label>
        </section>

        <section className="settings-card">
          <h2>Pagamentos / Gateway</h2>
          <p className="settings-card-copy">Provedor e chave de API.</p>
          <label className="field">
            <span>Provedor</span>
            <select value={payments.provider} onChange={(event) => setPayments((current) => ({ ...current, provider: event.target.value }))}>
              <option value="stripe">Stripe</option>
              <option value="mercadopago">Mercado Pago</option>
            </select>
          </label>
          <label className="field">
            <span>Chave de API</span>
            <input
              type="password"
              value={payments.apiKey}
              onChange={(event) => setPayments((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="sk_live_… ou APP_USR-…"
              autoComplete="off"
            />
          </label>
          <p className="settings-warning" role="note">
            Valide as chaves em ambiente de teste antes de usá-las em produção.
          </p>
        </section>

        <section className="settings-card">
          <h2>Equipe</h2>
          <p className="settings-card-copy">Usuários administradores e seus perfis.</p>
          <ul className="team-list">
            {defaultSettings.team.map((member) => (
              <li key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <small>{member.email}</small>
                </div>
                <span className={`status-label status-tone-${member.role === 'ADM' ? 'ativa' : 'pausada'}`}>{member.role}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="settings-footer">
          <button className="submit-button" type="submit">Salvar configurações</button>
        </footer>
      </form>
    </>
  )
}

export default Settings
