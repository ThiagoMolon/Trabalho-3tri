# Trabalho-3tri

## Loja pública

- Catálogo: `/loja`; detalhes de cada item: `/produto/:id`.
- Planos de assinatura: `/clube`; Taste Finder: `/quiz`; carrinho: `/carrinho`; checkout: `/destino`, `/pagamento` e `/confirmacao/:id`.
- As páginas públicas leem apenas produtos e planos ativos pelas rotas `/vitrine/produtos` e `/vitrine/planos`. O gerenciamento continua restrito às rotas administrativas existentes.
- O carrinho é armazenado no navegador; endereços, pedidos, estoque e assinaturas são persistidos no PostgreSQL. O checkout exige login, calcula frete estimado por CEP/peso e salva o endereço no perfil quando selecionado.
- O checkout de produtos usa Mercado Pago Checkout Pro; o pedido só é marcado como pago após a consulta autenticada ao Mercado Pago iniciada por um webhook assinado. O estoque é reservado quando o pedido é criado.
- Assinaturas usam planos recorrentes do Mercado Pago e só ficam ativas após autorização confirmada por webhook. O valor recorrente inclui o frete estimado para cada ciclo. Renovações automáticas ainda não criam pedidos de expedição nem movimentam o estoque no sistema.
- Produtos e uma assinatura no mesmo carrinho são pagos separadamente: autorize primeiro a assinatura, retorne ao site e depois pague os produtos. Uma autorização de assinatura por vez.
- Rotas transacionais autenticadas: `/addresses` (GET/POST/DELETE), `/orders` (POST), `/orders/me` (GET), `/orders/:id` (GET), `/orders/:id/mercadopago-preference` (POST), `/subscriptions/me` (GET), `/subscriptions/me/mercadopago-checkout` (POST) e `/subscriptions/me/:id` (GET/PATCH). O webhook público fica em `POST /webhooks/mercadopago`; o cálculo de frete fica em `POST /shipping/calculate`.
- Assinaturas autorizadas podem ter moagem/frequência alteradas e ser pausadas, retomadas ou canceladas em `/conta`; as alterações são sincronizadas com o Mercado Pago.

## Taste Finder

- O quiz público fica disponível em `/quiz`.
- No painel administrativo (`/admin`), abra **Taste Finder → Quiz** para cadastrar perguntas, respostas e pesos sensoriais.
- Os pesos de acidez, amargor e doçura vão de 0 a 10. O resultado é a média das respostas escolhidas.
- Ao terminar o quiz, a pessoa pode abrir a loja filtrada para cafés a até 1 ponto do perfil em cada característica. Cadastre acidez, amargor e doçura (0–10) no formulário de cada café; cafés sem os três valores continuam visíveis e são identificados como sem perfil cadastrado.
- O backend cria as tabelas do quiz ao iniciar e insere três perguntas iniciais somente quando ainda não há perguntas cadastradas.
- O resultado é exibido ao final do quiz e salvo em `users.taste_profile` quando a pessoa está autenticada. Sem login, o perfil continua visível, mas não é salvo.
- O painel e as rotas de gerenciamento exigem uma sessão administrativa.

## Cadastro e login

- Cadastro: `/cadastro`; login: `/login`; área da conta: `/conta`.
- Redefinição de senha: `/esqueci-senha`; o link enviado por e-mail expira em 30 minutos e só pode ser usado uma vez. Configure `RESEND_API_KEY` e `RESEND_FROM` no ambiente do backend. O remetente precisa pertencer a um domínio verificado no Resend; a API HTTPS evita depender de conexões SMTP de saída, que podem expirar no provedor de hospedagem.
- No Docker Compose, configure essas variáveis no `backend/.env`. Nunca publique a chave da API nem a inclua no frontend.
- As senhas são armazenadas como hashes bcrypt. A sessão usa um cookie assinado e `HttpOnly`, `SameSite=Lax` e validade de sete dias. Em produção, o cookie também é marcado como `Secure`.
- Configure `AUTH_TOKEN_SECRET` com pelo menos 32 caracteres aleatórios no ambiente do backend (por exemplo, gere com `openssl rand -base64 48`). Em produção, `NODE_ENV=production` marca o cookie como `Secure`.
- `FRONTEND_URL` define uma origem fixa para CORS e para os links de redefinição de senha. Para acessar o projeto por Dev Tunnel, deixe essa variável vazia: o backend aceita a origem HTTPS do túnel e usa essa mesma URL nos links enviados por e-mail. No Docker Compose, as chamadas da API passam pelo proxy do Vite na mesma origem. Se usar um domínio próprio, configure sua URL HTTPS em `FRONTEND_URL`, no `.env` da raiz ou em `backend/.env` ao executar o backend diretamente.
- Para acesso pela internet, use um Dev Tunnel ou outro serviço HTTPS público em vez de expor diretamente o servidor de desenvolvimento. Um IPv4 local só funciona em aparelhos na mesma rede.
- O backend cria a tabela `users` ao iniciar se ela ainda não existir.
- Depois de cadastrar uma conta normal, promova-a para administradora com `cd backend && npm run promote-admin -- email@exemplo.com`. O comando só altera uma conta existente; novos cadastros sempre recebem a role `customer`.
- Após a promoção, saia e entre novamente para que o login redirecione ao painel. Clientes não têm acesso ao painel nem às rotas administrativas de produtos, quiz, planos e assinaturas.

## Desenvolvimento local

Para iniciar frontend, API e banco de dados juntos com Docker Compose, execute na raiz do projeto:

```sh
docker compose up --build
```

Abra `http://localhost:5173`. O Vite atualiza a página automaticamente quando você altera arquivos do frontend; não é necessário fazer deploy para testar mudanças. A primeira inicialização pode demorar enquanto as imagens e dependências são preparadas. Configure `AUTH_TOKEN_SECRET` (com pelo menos 32 caracteres) em `backend/.env` antes de iniciar. Para parar, use `Ctrl+C` e depois `docker compose down`; os dados do banco permanecem no volume local.

Como alternativa, inicie a API na pasta `backend` (`npm run dev`) com `DATABASE_URL` e `AUTH_TOKEN_SECRET` configurados e, em outro terminal, o frontend na pasta `frontend` (`npm run dev`). Sem `VITE_API_URL`, o frontend usa a mesma origem e o Vite encaminha as chamadas para a API em `http://localhost:3000`. Configure `VITE_API_URL` quando o frontend e a API estiverem em endereços diferentes.

## Deploy do frontend no Cloudflare Pages

Com `npm` e Wrangler CLI instalados e autenticados, execute `./deploy.sh` na raiz do projeto. O script compila o frontend para usar a mesma origem e publica `frontend/dist` e a função proxy no Cloudflare Pages `trabalho-3tri`; assim, o cookie de sessão não depende de cookies de terceiros. A função encaminha as rotas da API para `https://trabalho-3tri.onrender.com`, exceto `/payments`, `/products` e `/data/*`, que são atendidas pelo Worker. Se os destinos mudarem, configure `API_ORIGIN` e `ADMIN_API_ORIGIN` nas variáveis do ambiente do Cloudflare Pages. O script para imediatamente se o build falhar, sem publicar arquivos antigos.

## Mercado Pago

Configure no ambiente do backend (por exemplo, no serviço Render), nunca no frontend:

- `MP_ACCESS_TOKEN`: credencial de teste (`TEST-...`) para homologação ou credencial de produção (`APP_USR-...`) quando a conta estiver pronta.
- `MP_WEBHOOK_SECRET`: segredo gerado na configuração de Webhooks do app no Mercado Pago.
- `FRONTEND_URL`: origem HTTPS do Cloudflare Pages, por exemplo `https://trabalho-3tri.pages.dev`.
- `MP_WEBHOOK_URL` (opcional): URL pública completa do webhook. Sem ela, o backend usa `${FRONTEND_URL}/webhooks/mercadopago`.

No painel de desenvolvedores do Mercado Pago, configure essa URL HTTPS para receber notificações de pagamentos e de assinaturas e use o segredo correspondente em `MP_WEBHOOK_SECRET`. O Cloudflare Pages encaminha `/webhooks/mercadopago` para a API. Teste primeiro com credenciais e usuários de teste do Mercado Pago; a tela **Configurações** do painel administrativo não salva nem valida credenciais.
