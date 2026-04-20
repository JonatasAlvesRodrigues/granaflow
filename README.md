# GranaFlow (100% Front-End)

Projeto de controle financeiro pessoal feito somente com:
- HTML
- CSS
- JavaScript

Sem Flask, sem Node e sem necessidade de localhost.

## Como usar

1. Abra o arquivo [index.html](./index.html) no navegador.
2. O app redireciona para `frontend/index.html`.
3. Cadastre sua conta e use normalmente.

## Armazenamento

Os dados do usuário autenticado são salvos no Supabase com cache local no `localStorage`:
- transações
- categorias
- contas
- recorrências
- metas
- tema (claro/escuro)

## Funcionalidades

- Cadastro, login, logout, recuperação de senha por email (Supabase)
- Dashboard com saldo, receitas, despesas e gráficos
- CRUD de transações com experiência simplificada e profissional
- CRUD de categorias
- Crédito com parcelas e faturas
- Lançamentos recorrentes
- Metas financeiras com progresso
- Relatórios mensal/comparação
- Exportação CSV
- Exportação PDF (via impressão do navegador)
- Insights automáticos inteligentes e notificações
- Layout responsivo + dark mode

## Atualizações recentes (UX + Insights)

### Insights automáticos mais inteligentes

- Comparativo mensal automático (ex.: transporte no mês atual vs mês anterior)
- Top 3 categorias que mais cresceram
- Sugestões práticas baseadas no histórico e no comportamento de gasto
- Insights separados por blocos na interface:
  - comparativo mensal
  - top categorias em alta
  - sugestões práticas

### Nova transação (mais simples e profissional)

- Formulário reorganizado com hierarquia visual melhor
- Toggle visual para `Tipo` (Entrada/Saída)
- Toggle visual para `Forma de pagamento` com ícones
- Comportamento dinâmico por tipo:
  - `Saída`: Dinheiro, PIX, Débito, Crédito
  - `Entrada`: Dinheiro/PIX e Freela
- Em `Entrada`, a categoria deixa de ser manual e é aplicada automaticamente:
  - `Freela` -> categoria `Freela`
  - `Dinheiro/PIX` -> categoria `Outras entradas`
- Removida opção de `Salário` na entrada manual (salário já pode ser automático mensal via recorrência)

### Filtros de transações

- Removido filtro por tipo `Entrada/Saída` na área de filtros
- Card de filtros agora fica oculto quando não há transações cadastradas

### Mobile (abas e espaço útil)

- Ajustes no dock inferior e no botão flutuante para evitar sobreposição de conteúdo
- Espaçamento inferior da área de conteúdo ajustado para garantir visibilidade do final das telas
- Botão flutuante de nova transação ocultado em abas onde atrapalhava leitura (ex.: Dashboard e Transações)

## Observações

- Os dados são sincronizados no Supabase por usuário autenticado.
- O `localStorage` ainda é usado como cache/backup local offline.

## Supabase (Login + Banco)

O projeto agora usa Supabase para:
- autenticação (cadastro/login/recuperação por email)
- persistência dos dados financeiros por usuário

### 1. Rodar SQL no Supabase (SQL Editor)

```sql
create table if not exists public.user_finance_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_finance_data enable row level security;

drop policy if exists "select own finance data" on public.user_finance_data;
create policy "select own finance data"
on public.user_finance_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "insert own finance data" on public.user_finance_data;
create policy "insert own finance data"
on public.user_finance_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own finance data" on public.user_finance_data;
create policy "update own finance data"
on public.user_finance_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 2. Auth no painel Supabase

- Em `Authentication > Providers > Email`, deixe Email habilitado.
- Se quiser login imediato sem confirmação, desative confirmação de email.

### 3. Segurança

- O projeto usa apenas `publishable/anon key` no front-end.
- Nunca coloque `service_role key` no navegador.
