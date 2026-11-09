import { PageHeading, ExportButton } from './shared'
import { formatDate } from './formatters'
import { customers } from './mockData'

function Customers() {
  return (
    <>
      <PageHeading
        eyebrow="BASE DE CLIENTES"
        title="Clientes"
        description="Cadastros, pedidos e resultado do quiz de paladar."
        actions={<ExportButton onClick={() => window.alert('Exportação de clientes em breve.')} />}
      />

      <section className="catalog-panel" aria-label="Lista de clientes">
        <div className="table-scroll">
          <table className="product-table admin-wide-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Cidade / CEP</th>
                <th>Pedidos</th>
                <th>Quiz de paladar</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((item) => (
                <tr key={item.id}>
                  <td className="product-name-cell"><strong>{item.name}</strong></td>
                  <td>{item.email}</td>
                  <td>{item.city} · {item.cep}</td>
                  <td>{item.orders}</td>
                  <td><span className="taste-chip">{item.taste}</span></td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default Customers
