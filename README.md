# Gestor de dispositivos Mentemovimento

Aplicacao web para gerir dispositivos da associacao com autenticacao, permissoes e base de dados em Supabase.

## Funcionalidades

- Login e criacao de conta com Supabase Auth.
- Listagem, pesquisa e filtro por estado.
- Criacao, edicao e remocao de dispositivos.
- Campos principais: nome, numero de serie, modelo, local, estado e notas.
- Importacao e exportacao CSV compativel com Google Sheets.
- Regras de acesso com perfis: `admin`, `manager` e `member`.

## Google Sheets

Para exportar para Google Sheets, usa o botao `Exportar CSV` e importa o ficheiro no Sheets.

Para importar do Google Sheets, exporta a folha como CSV e usa `Importar CSV`. As colunas aceites sao:

```text
ID, Numero de serie, Modelo, Local, Estado, Notas
```

Na importacao, o `Numero de serie` e usado para atualizar dispositivos existentes sem duplicar.

## Configurar Supabase

1. Entra no teu projeto Supabase.
2. Abre `SQL Editor`.
3. Cola e executa o conteudo de `supabase/schema.sql`.
4. Vai a `Project Settings > API`.
5. Copia o `Project URL` e a chave `anon public`.
6. Cria um ficheiro `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://o-teu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=a_tua_chave_anon
```

A primeira conta criada fica automaticamente com perfil `admin`. As contas seguintes ficam como `member`.

Para promover uma conta para gestor, executa no SQL Editor:

```sql
update public.profiles
set role = 'manager'
where id = 'ID_DO_UTILIZADOR';
```

## Executar localmente

```bash
npm install
npm run dev
```

## Publicar na Vercel

1. Coloca o projeto no GitHub.
2. Na Vercel, escolhe `Add New > Project`.
3. Importa o repositorio do GitHub.
4. Em `Environment Variables`, adiciona:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

5. Faz deploy.

## Enviar para GitHub

Cria um repositorio vazio no GitHub e depois corre:

```bash
git remote add origin https://github.com/TEU_UTILIZADOR/gestor-de-dispositivos-mentemovimento.git
git branch -M main
git push -u origin main
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
