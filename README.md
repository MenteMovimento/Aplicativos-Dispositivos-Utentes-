# Aplicativos MenteMovimento

Repositorio com os aplicativos internos da MenteMovimento.

## Aplicacoes

- `.`: site principal em React/Vite, preparado para Vercel e Supabase, com areas de `Dispositivos`, `Utentes`, `Estatisticas` e `Utilizadores`.
- `apps/utentes`: versao Python original do gestor de utentes, preservada como referencia do projeto `Utentes-MenteMovimento`.

O site principal fica na raiz para a Vercel publicar tudo como uma unica aplicacao. A pasta `apps/utentes` mantem a versao Python original sem desformatar, mas a area de utentes usada no site esta integrada no React.

## Funcionalidades do gestor de dispositivos

- Login e criacao de conta com Supabase Auth.
- Mensagens amigaveis para limite de emails e cooldown para reenviar confirmacao.
- Tema claro/escuro com preferencia guardada no navegador.
- Idiomas da interface: Portugues (Portugal) e Ingles.
- Listagem, pesquisa, filtro por estado e ordenacao crescente/decrescente por coluna.
- Criacao, edicao e remocao de dispositivos.
- Relatorio imprimivel dos dispositivos visiveis.
- Pagina de estatisticas com totais, marcas, tecnicos, avarias e resultados finais.
- Historico e anexos por dispositivo atraves do Supabase Storage.
- Aviso visivel para numeros de serie duplicados.
- Campos principais: nome, numero de serie, modelo, local, estado e notas.
- Importacao e exportacao CSV compativel com Google Sheets.
- Contas autenticadas conseguem gerir dispositivos.
- Area integrada de utentes com criacao, pesquisa, edicao e remocao.
- Area de utilizadores para criar contas, alterar nomes, eliminar acessos e gerir permissoes.

## Funcionalidades do gestor de utentes

O projeto em `apps/utentes` inclui:

- Login com perfis de `Administrador` e `Utilizador`.
- Criar, pesquisar, ver, editar e eliminar utentes.
- Formularios de referenciacao, emergencia, inscricao, diagnostico, atendimentos e protecao de dados.
- Genograma, ecomapa, anexos PDF, historico, tema claro/escuro e idiomas PT/EN.
- Suporte a SQLite local ou Supabase com `apps/utentes/supabase_schema.sql`.

## Google Sheets

Para exportar para Google Sheets, usa o botao `Exportar CSV` e importa o ficheiro no Sheets.

Para importar do Google Sheets, exporta a folha como CSV e usa `Importar CSV`. As colunas aceites sao:

```text
ID, Data Entrada, Marca, Modelo, Nº Série, CPU, RAM (GB), Disco, Sistema Operativo, Liga, Dá Imagem, BIOS, Estado Físico, Necessita Limpeza, Avaria, Diagnóstico, Peças Necessárias, Custo Estimado, Tempo Estimado (min), Técnico, Estado, Resultado Final, credencial administrador, privilegio, chrocme, aplicação, data copia de segurança, USB bloqueada, Conta GD, data copia de segurança Google Drive, Rastrear todas as contas GD e gmail e verificar acessos de partilha, Unifiormizar o desktop, App estimulação cognmitiva, Observações
```

Na importacao, o `Numero de serie` e usado para atualizar dispositivos existentes sem duplicar.

## Manual de utilizacao

Consulta `MANUAL.md` ou usa o botao `Manual` dentro da aplicacao.

## Configurar Supabase

### Dispositivos

1. Entra no teu projeto Supabase.
2. Abre `SQL Editor`.
3. Cola e executa o conteudo de `supabase/schema.sql`.
4. Vai a `Project Settings > API`.
5. Copia o `Project URL` e a chave `anon public`.
6. Cria um ficheiro `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://o-teu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=a_tua_chave_anon
SUPABASE_SERVICE_ROLE_KEY=a_tua_chave_service_role
```

Tambem podes usar os nomes novos da Supabase/Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://o-teu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=a_tua_chave_publishable
SUPABASE_SERVICE_ROLE_KEY=a_tua_chave_service_role
```

Todas as contas novas ficam automaticamente com perfil `admin`.

Se usares confirmacao por email no Supabase Auth, o site mostra um botao `Reenviar confirmacao` com cooldown para evitar o erro `email rate limit exceeded`. Para testes em aula, podes desativar a confirmacao de email em `Authentication > Providers > Email`; para producao, o ideal e configurar SMTP proprio.

Para corrigir contas antigas e permissões/RLS num projeto ja existente, executa o conteudo de `supabase/user-management.sql` no SQL Editor. Esse ficheiro coloca os perfis existentes como `admin`, permite que contas autenticadas usem dispositivos e prepara a area de utilizadores.

Para ativar historico e anexos, executa tambem `supabase/feature-upgrades.sql` no SQL Editor. Esse ficheiro cria as tabelas `device_history`, `device_attachments` e o bucket privado `device-attachments`.

Para promover uma conta para gestor manualmente, executa no SQL Editor:

```sql
update public.profiles
set role = 'manager'
where id = 'ID_DO_UTILIZADOR';
```

A chave `SUPABASE_SERVICE_ROLE_KEY` deve ficar apenas na Vercel ou no ambiente do servidor. Nunca uses essa chave com prefixo `VITE_`.

### Utentes

Para usar Supabase no gestor de utentes:

1. Abre `SQL Editor` no Supabase.
2. Cola e executa `apps/utentes/supabase_schema.sql`.
3. Copia `apps/utentes/.env.example` para `apps/utentes/.env`.
4. Preenche:

```env
SUPABASE_URL=https://o-teu-projeto.supabase.co
SUPABASE_SECRET_KEY=a_tua_service_role_ou_secret_key
SUPABASE_BUCKET=documentos-utentes
```

Sem estas variaveis, o gestor de utentes corre em SQLite local e cria `apps/utentes/utentes.db`.

## Executar localmente

Gestor de dispositivos:

```bash
npm install
npm run dev
```

Gestor de utentes:

```bash
npm run utentes:dev
```

ou:

```bash
python apps/utentes/app.py
```

Depois abre `http://127.0.0.1:8000`.

## Publicar na Vercel

1. Coloca o projeto no GitHub.
2. Na Vercel, escolhe `Add New > Project`.
3. Importa o repositorio do GitHub.
4. Em `Environment Variables`, adiciona:

```env
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

ou:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
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
npm run utentes:dev
npm run build
npm run lint
```
