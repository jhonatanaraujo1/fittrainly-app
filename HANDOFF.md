# Fit Studio Now (repo: fitTrainly) — HANDOFF (para uma IA sem contexto nenhum)

> Última atualização: 2026-07-11 (marca renomeada, captura de leads no ar, tema preto+dourado iniciado). Leia este arquivo inteiro antes de tocar em qualquer coisa.
> Ele cobre os DOIS repositórios, deploy, secrets, regras de negócio, bugs já resolvidos e o que falta.
> ⚠️ A marca DE DISPLAY agora é **"Fit Studio Now"** (era "fitTrainly"). Os nomes de REPO/pacote/cookies/localStorage continuam `fittrainly-*` de propósito — NÃO renomear (quebra sessões e build).

---

## 0. ATUALIZAÇÃO 2026-07-11 (ler primeiro — deltas desde 09/jul)

- **MARCA renomeada** `fitTrainly` → **"Fit Studio Now"** em todo texto visível (front: sidebar/login/landing/metadata/relatórios; backend: emails). Identificadores internos (`fittrainly-auth`/`-refresh`/`-role`, repo, package) **mantidos** — renomear quebra sessão/build. Domínio: fitstudionow.com.

- **CAPTURA DE LEADS PÚBLICA — no ar.** Página hospedada `/l/{slug}` (ex.: `https://www.fitstudionow.com/l/mg-estudio`) — o link vai na landing/bio/anúncios do estúdio; o lead cai no CRM (`/admin/leads`, status NEW, source "Site"). Segurança: `POST /api/v1/public/leads/{slug}` é **write-only** (204, sem eco), **fail-closed** por chave de servidor `X-Lead-Capture-Key` (env `LEAD_CAPTURE_SERVER_KEY`, MESMO valor no Railway E na Vercel), **rate-limit por prefixo** no `LoginRateLimitFilter` (corrigido: era match exato de URI e não pegava rotas com slug), **honeypot + time-trap** (route handler `/api/lead-capture` no servidor Next guarda a chave), **anti-enumeração** (estúdio inexistente/inativo/desligado dão o mesmo 404; dedupe 24h silencioso), **RGPD** (`leads.consent_at`/`consent_version`, migration V2). `Tenant.leadCaptureEnabled` (kill-switch) + `privacyPolicyUrl`. `GET /api/v1/public/studios/{slug}` (info pública p/ a página). Ver `com.fittrainly.lead.Public*`.

- **🔴 BUG CRÍTICO corrigido — status de lead EN↔PT.** O backend usa `LeadStatus` em INGLÊS (NEW/CONTACTED/VISIT_SCHEDULED/…); a CRM agrupa em PORTUGUÊS (NOVO/CONTACTADO/…). O `real-api.leadApi.list` devolvia o status cru → lead real (ex.: capturado pelo form) chegava como `NEW`, não caía em nenhuma coluna e a CRM mostrava **"0 leads no pipeline"** mesmo com o lead no banco, no tenant certo. `tsc` NÃO pega (lead é `Record<string,unknown>`). **Corrigido**: `mapLead` traduz status EN→PT + renomeia campos (`interest→interesse`, `assignedTo→responsavel`, `notes→observacoes`, `interestedPlan→planoInteresse`, `visitDate→visitaDate`, `enrolledAt→inscritoEm`); `updateStatus` faz PT→EN (senão mover no pipeline dava 400). **Padrão a auditar**: todo `*Api` do `real-api` pode ter esse tipo de mismatch de enum/campo vs. o que a UI (mock shape) espera.

- **MENU CONFIGURAÇÕES central** (de volta) em `/admin/configuracoes` (grupo Sistema) — **layout de abas** compacto (Identidade / Leads / Agenda / Faturação). Identidade = nome + política de privacidade (edita o `Tenant`); Leads = toggle de captura + link partilhável; Agenda = duração de aula + atalho horário; Faturação = atalhos. Backend `/studio-config` (GET qualquer autenticado, PATCH admin) estendido: `name`, `slug`, `privacyPolicyUrl`, `leadCaptureEnabled`, `classDurationMinutes`.

- **⚠️ GOTCHA framer-motion (React 19 / Next 16):** `AnimatePresence mode="wait"` + `layoutId` **quebra a interatividade** de cliques da página inteira (a página hidrata — inputs controlados revertem — mas `onClick` não propaga; a aba não troca). Foi bug real na Configurações; removido (trocado por estado puro + CSS). **Auditar outras telas que usam `AnimatePresence mode="wait"`.** `motion.div` simples (initial/animate) e o `layoutId` isolado da sidebar (que não envolve conteúdo interativo) estão OK.

- **TEMA PRETO+DOURADO + borda LED — iniciado (referência).** Nova utility em `globals.css`: `.led-gold` (fio dourado #C9A84C + glow externo difuso, tipo fita LED) e `.led-gold-pulse` (respira devagar — usar só em 1-2 destaques). Aplicado como **tela de referência** no **Dashboard admin** (`/admin`): canvas preto `#0a0a0a`, cards `#141414`, dourado só nos acentos. **NÃO** tocou o `StatCard` compartilhado nem o layout global. **ROLLOUT PENDENTE** pro resto do app (todas as telas admin/PT/aluno + `StatCard` variante escura + fundo do layout + header mobile preto). Regra: dourado é realce, não "tudo dourado". Login/landing já eram escuros.

- **Recuperação de senha por código de 6 dígitos** (sessão paralela) — o email do admin `maicon@mgestudio.pt` é FAKE, então o fluxo por link não entregava; agora há código. Para repor senha do admin direto no banco há `fittrainly-app/scripts/hash-password.mjs` (gera hash bcrypt cost 10; `npm i --no-save bcryptjs` + `node scripts/hash-password.mjs`).

- **Git 11/jul:** front `main` (Vercel) e back `main` (Railway) — `dev/mg-estudio` deletada, só `main`. Após `git pull` no front, rodar **`npm install`** (o PR do Vercel Speed Insights adicionou dep; senão "Module not found @vercel/speed-insights"). `.env.local` (gitignored) do front: `NEXT_PUBLIC_USE_REAL_BACKEND=true` em uso normal — se estiver `false` foi eu testando design em mock, reverter p/ `true`.

- **Pendências novas:** (1) **rollout do tema preto+dourado**; (2) **auditoria framer-motion** `AnimatePresence mode="wait"`; (3) **auditoria mock↔real** de todos os `*Api` (enum/campo) — o bug dos leads é o exemplo; (4) editor de **horário de funcionamento** + config de **cancelamento** DENTRO de Configurações (hoje só atalho/hardcoded); (5) bucket S3 vazio (nenhuma tela faz upload ainda); (6) apagar lead de teste "Teste Diagnostico Claude".

---

## 1. O que é o produto

**fitTrainly** — SaaS de gestão para **estúdios boutique de personal training**. O estúdio aluga espaço a PTs independentes; cada PT tem seus próprios alunos.

- **Cliente real em produção:** MG Estúdio (dono **Maicon Godoi**, Almada, Portugal). **Não é demo — está em uso real.**
- **3 perfis:** `ADMIN` (dono do estúdio), `PERSONAL_TRAINER`, `ALUNO`.
- Idioma da UI: **português de Portugal**. Código/identificadores em inglês.
- Moeda: EUR. IVA 23% (só exibição, calculado sobre valores líquidos).

---

## 2. Repositórios, branches e deploy

| Repo | Caminho local | Stack | Branch de produção | Deploy |
|---|---|---|---|---|
| `fittrainly-app` (frontend) | `C:\Users\Minas\PROJECTS\fitTrainly\fittrainly-app` | Next.js 16 (App Router) + TS + Tailwind + React Query + Zustand | **`main`** | Vercel (auto) |
| `fittrainly-backend` | `C:\Users\Minas\PROJECTS\fitTrainly\fittrainly-backend` | Kotlin + Spring Boot 3.3.6 + JPA/Hibernate + Postgres + Flyway, Java 21 | **`main`** | Railway (auto) |

- GitHub: `jhonatanaraujo1/fittrainly-app` e `jhonatanaraujo1/fittrainly-backend`.
- **Branch backend: SÓ EXISTE `main`.** A `dev/mg-estudio` foi **DELETADA** (remota e local) em 2026-07-09 por ordem do dono. **NUNCA recriar, NUNCA pushar para outra branch — só `main`.** ✅ Railway já confirmado apontando pra `main` (verificado 09/jul: `POST /api/v1/onboarding` → 400, não 404).
- Commits terminam com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Push sem pedir permissão** é a norma nesse projeto (após verificar que compila/roda).

### ⚠️ Armadilha: CLAUDE.md do backend está DESATUALIZADO

`fittrainly/CLAUDE.md` descreve uma stack **Prisma/SQLite/NextAuth** que **NÃO é a real**. É um briefing antigo de "monte o MVP". **Ignore-o.** A stack real é Kotlin/Spring/Postgres (backend) + Next.js/mock-facade (frontend). O `fittrainly-app/AGENTS.md` avisa que o Next.js tem breaking changes — leia os docs em `node_modules/next/dist/docs/` se precisar.

---

## 3. Arquitetura do frontend (importante entender)

O frontend nasceu 100% mockado e migrou pra backend real via **camada de fachada**:

- `src/lib/mock-api.ts` — implementação fake (dados em memória via `mock-db.ts`).
- `src/lib/real-api.ts` — chama o backend Kotlin real.
- `src/lib/api.ts` — **fachada**: para cada domínio decide mock vs real.
- `src/lib/api-config.ts` — **INTERRUPTOR MESTRE**:
  ```ts
  const ALL_REAL = process.env.NEXT_PUBLIC_USE_REAL_BACKEND === 'true'
  const on = (v) => ALL_REAL || v === 'true'
  ```
  Com `NEXT_PUBLIC_USE_REAL_BACKEND=true`, **todos os domínios usam o backend real de uma vez**.

- **Segurança anti-dado-fake:** quando o modo real está ligado, os arrays de seed do `mock-db.ts` são **esvaziados** (`REAL_BACKEND_MODE`) — assim qualquer página que leia `db.*` direto mostra vazio (correto), nunca João/Ana/Pedro fake. **Regra inegociável: zero dado mock/fake visível em produção.**

- **Descompasso de modelo mock↔real (LEIA antes de mexer em agenda/booking):** o mock modela um "slot compartilhado" (slotKey = data+hora, capacidade do estúdio = 4 entre todos os PTs). O backend real modela `Availability` como entidade **por-PT** (maxStudents=1, 1-on-1); o teto compartilhado do estúdio (`Tenant.studioCapacity=4`) é enforced **só no servidor** no `BookingService.create`. O `real-api.ts` **sintetiza o grid** client-side a partir da lista plana de availabilities + horas de funcionamento. Comentário gigante explicando isso no topo de `real-api.ts`.

- **Auth store** (`src/store/auth.ts`, Zustand + persist): `accessToken` no localStorage (`fittrainly-auth`); `refreshToken` em cookie `fittrainly-refresh` (90 dias, **não httpOnly**, lido via `js-cookie`); `fittrainly-role` em cookie.

- **Refresh de token (CRÍTICO, corrigido em 09/jul):** `apiFetch` em `real-api.ts` intercepta **401 → chama `/auth/refresh` (single-flight) → retry**; se o refresh falhar, limpa a sessão e manda pro `/login`. Endpoints `/auth/*` ficam de fora pra não criar loop. **Antes disso, o token expirava (~15-30min) e o app inteiro quebrava calado (agenda "Sem slots", faturação vazia).**

---

## 4. Arquitetura do backend

- Pacote raiz `com.fittrainly`. Camadas: Controller (fino) → Service (lógica) → Repository (JPA).
- **Multi-tenancy:** `TenantContext` (ThreadLocal). **Nunca** `findById` cru — sempre `findByIdAndTenantId` (prevenção de IDOR).
- **Flyway** migrations em `src/main/resources/db/migration/`. As antigas V1..V16 foram **consolidadas num único `V1__baseline.sql`** (squash, 09/jul — projeto começando, banco zerado). Daqui pra frente, TODA mudança de schema é uma migration NOVA (V2, V3, …) — nunca editar o baseline. `ddl-auto: validate` (schema vem 100% das migrations; JPA só valida). ⚠️ O baseline só aplica num banco **sem `flyway_schema_history`** — resetar o banco (`scripts/reset_db.sql`) antes do 1º deploy dele. Só schema, sem dados: seeds são criados em runtime pelo `TenantProvisioningService`.
- **Provisionamento de tenant:** `TenantProvisioningService.provisionStudio()` (chamado pelo `ProductionBootstrap` **no boot**) cria/recupera o estúdio e garante baseline idempotente: horas de funcionamento, configs de notificação, modalidades, planos-modelo, **pastas do bucket S3**. Serve também pra retro-preencher tenants antigos.
- **Bootstrap de produção:** com `DEMO_SEED_ENABLED=false` + `BOOTSTRAP_ADMIN_*` setados, cria **UM** admin real (o dono). **Nunca cria PT/aluno/reserva fake.**
- **GlobalExceptionHandler:** `IllegalArgumentException` → 400 (UUID/enum malformado é erro do cliente, não 500).
- **Rate limit no login:** `LoginRateLimitFilter` (bucket4j, 5 tentativas/min por IP) — cobre `/auth/login` e `/auth/forgot-password`. Se você testar login em loop, ele bloqueia temporariamente (cool-down ~1 min).
- **EmailService** (Resend) e **TenantStorageService** (S3) fazem **no-op** silencioso se as envs não estiverem setadas — nunca derrubam o boot.

---

## 5. Variáveis de ambiente / secrets

**Os valores reais estão no Railway (backend) e Vercel (frontend). Nunca hardcode secrets. Nunca cole chaves em chat.**

### Backend (Railway → serviço backend → Variables)
```
DB_URL, DB_USER, DB_PASSWORD          # Postgres (Railway injeta)
JWT_SECRET                            # assinatura dos tokens
JWT_ACCESS_EXP, JWT_REFRESH_EXP       # TTLs (têm default)
FRONTEND_URL                          # CORS (aceita lista separada por vírgula; *.vercel.app é auto-adicionado)
FRONTEND_LOGIN_URL                    # link nos emails
DEMO_SEED_ENABLED=false               # PRODUÇÃO. true criaria dados fake
BOOTSTRAP_ADMIN_EMAIL / _PASSWORD / _NAME   # cria o admin dono no boot
BOOTSTRAP_TENANT_SLUG / _NAME         # default slug "mg-estudio"
RESEND_API_KEY, RESEND_FROM_EMAIL     # email transacional
S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY   # bucket (Tigris/storageapi.dev)
```
Mapeamento em `application.yml` sob `app.*` (ver `common/config/AppProperties.kt`).
⚠️ **Bug histórico já corrigido:** o campo era `enabled` mas o YAML era `seed-enabled` → `DEMO_SEED_ENABLED=false` **nunca funcionava**. Hoje é `seedEnabled`. Se mexer, mantenha nome batendo.

### Frontend (Vercel → Environment Variables)
```
NEXT_PUBLIC_API_URL=https://api.fitstudionow.com
NEXT_PUBLIC_USE_REAL_BACKEND=true     # interruptor mestre → tudo real
RESEND_API_KEY, RESEND_FROM_EMAIL     # rota /api/send-email
```
`.env.local` (só local) já aponta pro backend de produção — útil pra QA local contra prod.

---

## 6. Como subir localmente

### Backend
```bash
cd fittrainly-backend
# precisa de um Postgres local + as env vars (DB_URL/USER/PASSWORD, JWT_SECRET, etc.)
./gradlew bootRun
# compilar só: ./gradlew compileKotlin
```
Porta padrão 8080. Migrations rodam sozinhas (Flyway) no boot.

### Frontend
```bash
cd fittrainly-app
npm install
npm run dev            # porta 3000
npx tsc --noEmit       # type-check (rodar SEMPRE antes de commit)
```
`.env.local` já aponta `NEXT_PUBLIC_API_URL=https://api.fitstudionow.com` + `USE_REAL_BACKEND=true`.
Há um `.claude/launch.json` (config de preview) com `autoPort:true` — não commitar mudanças nele.

---

### Cadastro de novo estúdio (self-service, 09/jul)
- **`POST /api/v1/onboarding`** (público, rate-limited 5/min/IP) cria um estúdio novo: tenant + admin + seeds baseline (via `TenantProvisioningService`) e devolve tokens (auto-login). Body: `{ companyName, adminName, adminEmail, adminPassword (min 8), slug? }`. Slug derivado do nome se omitido, único, `mg-estudio` reservado. Email já usado → 409. **Sem tela ainda** — chamável via curl/Postman; um form/link futuro faz POST aqui. Cada estúdio é um tenant isolado (multi-tenant); o mg-estudio nunca é afetado. Ver `com.fittrainly.onboarding.*`.

## 7. Produção — URLs e acesso

- **Frontend:** https://www.fitstudionow.com (Vercel, deploya da `main`).
- **Backend:** https://api.fitstudionow.com (Railway, deploya da `main` — confirmar que Source → Branch = `main`, já que `dev/mg-estudio` foi deletada).
- **Postgres:** serviço "Fit Studio DB" no Railway (proxy TCP público na aba Database).
- **Bucket:** "fit-bucket" no Railway (S3-compatível). Provisionado mas **as pastas só nascem no boot via `provisionTenantFolders`**; nenhuma tela faz upload ainda.
- **Admin de produção (MG Estúdio):** email `maicon@mgestudio.pt`. **A senha NÃO fica neste documento** (evitar vazamento no git) — ela é definida via `BOOTSTRAP_ADMIN_PASSWORD` no Railway e conhecida pelo dono; peça a ele ou recupere via fluxo "Esqueceu a password?". É o único usuário real — PT/alunos são cadastrados pelo próprio admin na UI.

---

## 8. Regras de negócio (não improvisar)

### Billing por faixas (planos `TIERED_HOURLY`) — modelo de ALUGUEL
O PT **paga ao estúdio** pelas horas usadas (não o contrário). Quanto mais horas, mais barata a faixa marginal.
- **Cálculo é PROGRESSIVO (tipo IRS)** — cada faixa cobra a própria taxa. Ex.: 25h = 20h×€20 + 5h×€19,50. (O dono chegou a descrever "flat retroativo", mas **confirmou progressivo** em 09/jul. `computeTieredAmount` em `mock-api.ts` é a fonte da verdade; backend porta a mesma lógica.)
- Faixas atuais MG: 1–20h €20 · 21–30h €19,50 (+bónus €25) · 31–40h €19 (+€50) · 41h+ €18,50 (+€75).
- **Ciclo semanal:** toda segunda adianta as horas da semana à taxa da faixa 1 (€20); **última segunda do mês** soma tudo, aplica progressivo + bónus, e gera o **acerto retroativo** (crédito ao PT = valor real − adiantado, tipicamente negativo).
- **Configurar** faixas: `admin/plans` (editor de faixas quando o plano é `TIERED_HOURLY`). **Monitorar** por PT: `admin/billing` (tabela-resumo `TierMonthlySummary`: horas, faixa, desconto, bónus, com linha expansível).
- **Progressões diferentes por PT** = crie múltiplos planos `TIERED_HOURLY` e atribua. Não precisa de conceito novo. Começar com 1.
- 🚫 Nunca automatizar ação financeira sem validação humana.

### Cancelamento de sessão (aluno)
- **> 24h:** aluno cancela sozinho.
- **12–24h:** não cancela sozinho — o diálogo orienta **contactar o estúdio** (o admin cancela pela agenda). Backend já rejeita < 24h.
- **< 12h:** fechado. Lógica em `src/components/cancel-booking-dialog.tsx` (3 faixas por `startTime`).

### Agenda / slots (feature EM ANDAMENTO — ver §10)
- Capacidade do estúdio: **4 vagas compartilhadas** entre todos os PTs no mesmo horário (não por PT). Enforced no `BookingService.create`.
- Horas de funcionamento (`StudioSchedule`, por dia da semana). Default: Seg–Sex 07:00–20:20, Sáb 09:00–13:00, Dom fechado. Editável (endpoint existe; **UI de edição ainda não existe**).
- Bloqueios pontuais (`StudioBlock`): feriado/fechado, na Agenda do Estúdio ("Bloquear horários").
- **⚠️ SLOT ≠ AULA (não confundir — foi fonte de bug):**
  - **SLOT** = cadência da grade, de quanto em quanto tempo abre um horário (`Tenant.slotDurationMinutes`). **Agora 30** → a Agenda abre de 30 em 30 min (07:00, 07:30, 08:00…).
  - **AULA** = duração da sessão dentro do slot (`Tenant.classDurationMinutes`). **Agora 30**. Folga do PT entre alunos = slot − aula (0 quando iguais).
  - Endpoints: `GET /api/v1/studio-config` (qualquer autenticado, devolve os dois) e `PATCH /api/v1/studio-config` (admin — **só edita a AULA**, valida 0 < aula ≤ slot). **Não há endpoint/UI para mudar o SLOT**: muda só via default de `Tenant` + migration (V16 pôs 30).
  - Frontend (V14 ✅): `studioConfigApi` na fachada (real+mock+flag). A grade é montada com `slotDurationMinutes` (passo) e `classDurationMinutes` (encaixe/endTime): `endTime = início + aula`, inclui um horário se `t + aula <= close`. Botão **"Aula: Xmin"** na Agenda edita a aula. Textos são dinâmicos ("Slots de X min"). Constantes: `SLOT_STEP`/`mockStudioConfig`/`DEFAULT_STUDIO_CONFIG`.

---

## 9. Bugs críticos já resolvidos (não reintroduzir)

1. **Refresh de token (09/jul):** `apiFetch` não renovava → sessão morria em ~15-30min, tudo dava 401, agenda/faturação em branco. Corrigido com refresh single-flight + retry + redirect.
2. **forgot-password vazava a senha em texto na resposta HTTP** (account takeover). Corrigido: resposta **genérica**, senha só logada no servidor. `AuthDtos.kt` tem comentário "NUNCA adicionar tempPassword aqui".
3. **CORS 403 em produção:** `WebConfig` usa `allowedOriginPatterns`, split por vírgula do `FRONTEND_URL`, auto-add `https://*.vercel.app`.
4. **Dado fake em produção:** 15 páginas liam `mock-db` direto → esvaziamento do seed em modo real resolveu tudo num ponto.
5. **`DEMO_SEED_ENABLED=false` não funcionava** (campo `enabled` ≠ YAML `seed-enabled`). Renomeado pra `seedEnabled`.
6. **500 ao salvar PT sem plano** (`UUID.fromString("")`). Guard `isBlank` + `IllegalArgumentException`→400.
7. **base-ui `Select` mostrava UUID** em vez do nome. Precisa de `items={[{value,label}]}`.
8. **Tela branca em sessão dessincronizada / persistência do mock em localStorage** — ver tasks #20/#21.
9. **Agenda vazia num estúdio zerado (09/jul):** `adminScheduleApi.list`/`availabilityApi.studioGrid` (real) só agrupavam `Availability` existentes → grid vazio, sem célula pra criar o 1º slot. Corrigido: ambos materializam a grade das horas de funcionamento (+ fallback `DEFAULT_STUDIO_HOURS`), então células "+ PT" aparecem mesmo com zero availabilities.
10. **Emails de credencial na criação (09/jul):** PT e aluno recebem email de boas-vindas (login=email + senha + mini-tutorial, por papel) no ATO da criação, disparado pelo BACKEND (`EmailService.sendWelcome` em `PersonalTrainerService.create`/`StudentService.create`) — **fonte única**. O frontend deixou de disparar (era duplicado). Requer `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (@fitstudionow.com) no Railway.
11. **Mock/demo fora de produção (09/jul):** login não importa mais `db` do mock-db (hint pós-falha agora genérico); botões "Acesso rápido — Demo" escondidos quando `USE_REAL.auth`.
12. **"+ PT" com 0 PTs ativos (09/jul):** o seletor só lista PTs ativos; sem nenhum ativo mostrava "Todos os PTs já alocados" (enganoso). Agora distingue "Sem PTs ativos" / "Todos alocados neste horário" / "Nenhum encontrado".

---

## 10. O que falta (pendências)

1. ~~[FRONTEND] duração-de-aula configurável (V14)~~ ✅ **FEITO 09/jul.** `studioConfigApi` na fachada; grade separada por `slotDurationMinutes` (cadência) e `classDurationMinutes` (aula); botão "Aula: Xmin" na Agenda; textos dinâmicos. Depois disso: SLOT baixado 60→30 (V16) e AULA 40→30 (V15) — Agenda de 30 em 30 min. Ver §8.
2. ~~[INFRA] Railway do backend → confirmar Source → Branch = `main`~~ ✅ **CONFIRMADO 09/jul.** O Railway já deploya da `main`: `POST /api/v1/onboarding` responde **400** (existe) em vez de 404, provando que o código mais recente da `main` está em produção. Nada a fazer.
3. **[INFRA] Bucket vazio:** as `S3_*` estão setadas; as pastas nascem no boot via `provisionTenantFolders`. Se continuar vazio, ver logs do deploy (`Storage S3 não configurado` = var errada; `Falha ao iniciar cliente S3`/erro PutObject = credencial/endpoint/bucket errado). Nenhuma tela faz **upload** ainda — quando for construir (foto de avaliação, avatar), aí o bucket ganha função real.
4. **[NEGÓCIO] IVA 23%** ainda pendente de confirmação do cliente (não bloqueante).
5. **[LIMPEZA] Registro de teste "QA Teste PT"** no Postgres de produção (desativado, não hard-deletado). userId `47213c92-aed0-4789-8ba3-02cb290a2cf1`, PT id `68cd7b41-2f1d-4074-8de6-b71f5baa0691`. Sem endpoint de hard-delete (soft-delete por design) — apagar via aba Data do Railway se quiser.

---

## 11. Convenções e regras de trabalho

- **Verificar antes de commit:** frontend `npx tsc --noEmit` limpo; backend `./gradlew compileKotlin` limpo. Preferir verificação end-to-end via preview (ferramentas `preview_*`) contra o backend real.
- **Preview local:** `preview_start` usa `.claude/launch.json`. Se a porta 3000 estiver ocupada por um `next dev` órfão, ele bloqueia — matar o PID e reiniciar sob o preview.
- **Português nos textos de usuário**, inglês no código. Sem mid-sentence bold. Sentence case.
- **Padrão do dono (CLAUDE.md global):** business-first, production-grade, segurança bloqueante, zero secret hardcoded, zero código sem tratamento de erro, zero "resolve depois" quando custa caro corrigir depois. Na dúvida entre rápido e certo: o certo.
- **Nunca** entrar credenciais/secrets você mesmo — guiar o dono.
- **Auditoria estática obrigatória** quando mexer na fachada de API: `tsc` NÃO pega método inexistente por causa de casts `as unknown` — conferir manualmente que todo método chamado pela UI existe em `real-api.ts`.

---

## 12. Estado do git em 2026-07-09 (confirmado, fim do dia)

- Backend: **só existe `main`** (`dev/mg-estudio` deletada). `origin/main` = **`ce593ca`** (onboarding endpoint + V1..V16 consolidadas num único `V1__baseline.sql` + `scripts/reset_db.sql`).
- Frontend `main` = `origin/main` = **`2b1f616`**.
- Ambos os `main` no GitHub com tudo. Nada pendente de push.
- Migrations do backend: **um único `V1__baseline.sql`** (as antigas V1..V16 foram squashadas). Próxima será `V2__...`.

---

## 13. Memória persistente do dono

Há um sistema de memória em `C:\Users\Minas\.claude\projects\C--Users-Minas\memory\` (índice em `MEMORY.md`). Cobre também OUTROS projetos do dono (PsicoAI, PTrainer.app, operação de infoprodutos, Meta Ads) — **não confunda com o fitTrainly**. Leia o `handoff_log.md` de lá se precisar do estado geral do dono, mas o fitTrainly é este documento.
