# Trabalho-3tri

## Taste Finder

- O quiz público fica disponível em `/quiz`.
- No painel administrativo (`/`), abra **Taste Finder → Quiz** para cadastrar perguntas, respostas e pesos sensoriais.
- Os pesos de acidez, amargor e doçura vão de 0 a 10. O resultado é a média das respostas escolhidas.
- O backend cria as tabelas do quiz ao iniciar e insere três perguntas iniciais somente quando ainda não há perguntas cadastradas.
- O resultado do quiz é exibido na sessão e ainda não é salvo em `users.taste_profile`.
- O painel e as rotas de gerenciamento exigem uma sessão administrativa.

## Cadastro e login

- Cadastro: `/cadastro`; login: `/login`; área da conta: `/conta`.
- Redefinição de senha: `/esqueci-senha`; o link enviado por e-mail expira em 30 minutos e só pode ser usado uma vez. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM` no ambiente do backend para habilitar o envio.
- Para Gmail, use `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, seu endereço completo em `SMTP_USER`, uma senha de app do Google em `SMTP_PASS` e o mesmo endereço em `SMTP_FROM`. Gere a senha de app na Conta Google com a verificação em duas etapas ativada; remova os espaços exibidos e nunca use a senha normal da conta. O Docker Compose carrega essas variáveis de `backend/.env`.
- As senhas são armazenadas como hashes bcrypt. A sessão usa um cookie assinado, `HttpOnly`, `SameSite=Lax` com validade de sete dias.
- Configure `AUTH_TOKEN_SECRET` com pelo menos 32 caracteres aleatórios no ambiente do backend (por exemplo, gere com `openssl rand -base64 48`). Em produção, `NODE_ENV=production` marca o cookie como `Secure`.
- `FRONTEND_URL` define uma origem fixa para CORS e para os links de redefinição de senha. Para acessar o projeto por Dev Tunnel, deixe essa variável vazia: o backend aceita a origem HTTPS do túnel e usa essa mesma URL nos links enviados por e-mail. No Docker Compose, as chamadas da API passam pelo proxy do Vite na mesma origem. Se usar um domínio próprio, configure sua URL HTTPS em `FRONTEND_URL`, no `.env` da raiz ou em `backend/.env` ao executar o backend diretamente.
- Para acesso pela internet, use um Dev Tunnel ou outro serviço HTTPS público em vez de expor diretamente o servidor de desenvolvimento. Um IPv4 local só funciona em aparelhos na mesma rede.
- O backend cria a tabela `users` ao iniciar se ela ainda não existir.
- Depois de cadastrar uma conta normal, promova-a para administradora com `cd backend && npm run promote-admin -- email@exemplo.com`. O comando só altera uma conta existente; novos cadastros sempre recebem a role `customer`.
- Após a promoção, saia e entre novamente para que o login redirecione ao painel. Clientes não têm acesso ao painel nem às rotas administrativas de produtos, quiz, planos e assinaturas.

Para rodar localmente, inicie a API na pasta `backend` (`npm run dev`) com `DATABASE_URL` e `AUTH_TOKEN_SECRET` configurados e o frontend na pasta `frontend` (`npm run dev`). O frontend local usa `http://localhost:3000` por padrão; no Docker Compose, usa o proxy da mesma origem, compatível com acesso por Dev Tunnel HTTPS. Configure `VITE_API_URL` apenas se a API estiver em outro endereço.

## Deploy do frontend no Cloudflare Pages

Com Docker Compose e Wrangler CLI instalados e autenticados, execute `./deploy.sh` na raiz do projeto. O script inicia os serviços com `docker compose up -d`; se esse comando falhar, o build e o deploy não serão executados. Em seguida, compila o frontend com `VITE_API_URL=https://trabalho-3tri.origin-beans01.workers.dev` e publica `frontend/dist` no projeto Pages `trabalho-3tri`.