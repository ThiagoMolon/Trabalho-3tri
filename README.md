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
- As senhas são armazenadas como hashes bcrypt. A sessão usa um cookie assinado, `HttpOnly`, `SameSite=Lax` com validade de sete dias.
- Configure `AUTH_TOKEN_SECRET` com pelo menos 32 caracteres aleatórios no ambiente do backend (por exemplo, gere com `openssl rand -base64 48`). Em produção, `NODE_ENV=production` marca o cookie como `Secure`.
- `FRONTEND_URL` define a origem permitida para CORS com credenciais e deve corresponder à URL do frontend.
- O backend cria a tabela `users` ao iniciar se ela ainda não existir.
- Depois de cadastrar uma conta normal, promova-a para administradora com `cd backend && npm run promote-admin -- email@exemplo.com`. O comando só altera uma conta existente; novos cadastros sempre recebem a role `customer`.
- Após a promoção, saia e entre novamente para que o login redirecione ao painel. Clientes não têm acesso ao painel nem às rotas administrativas de produtos, quiz, planos e assinaturas.

Para rodar, inicie a API na pasta `backend` (`npm run dev`) com `DATABASE_URL` e `AUTH_TOKEN_SECRET` configurados e o frontend na pasta `frontend` (`npm run dev`). O frontend usa `http://localhost:3000` por padrão; configure `VITE_API_URL` se a API estiver em outro endereço.