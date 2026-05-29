# Utentes MenteMovimento

Aplicacao web local em Python para gerir utentes da MenteMovimento.

## Funcionalidades

- Login com credenciais.
- Perfis de `Administrador` e `Utilizador`.
- Criar, pesquisar, ver, editar e eliminar utentes.
- Separadores estruturados por utente:
  - Formulario de Referenciacao.
  - Informacoes em Caso de Emergencia.
  - Ficha de Inscricao e Avaliacao Inicial de Requisitos.
  - Avaliacao Diagnostica Multidisciplinar.
  - Registo de Atendimentos e Acompanhamentos.
  - Protecao de dados e Termos de Responsabilidade.
- Campos interligados entre separadores, como nome, data de nascimento, contactos, processo e problemas de saude.
- Guardar automaticamente em segundo plano ao mudar de separador.
- Aviso quando existem alteracoes por guardar.
- Genograma e ecomapa editaveis.
- Anexos PDF por utente.
- Gestao de utilizadores.
- Historico de alteracoes.
- Tema claro/escuro.
- Interface em Portugues/Ingles.
- Manual integrado no menu.

## Como correr localmente

Requisitos:

- Python 3.11 ou superior.

Na pasta do projeto:

```powershell
python app.py
```

Depois abra:

```text
http://127.0.0.1:8000
```

## Acesso inicial

Na primeira execucao, se ainda nao existirem utilizadores, e criado automaticamente um administrador inicial:

- Email: `admin@mentemovimento.local`
- Password: `admin123`

Depois de entrar, use `Gestor de Utilizadores` para criar contas reais e trocar a password inicial.

## Usar Supabase

A aplicacao continua a funcionar em SQLite quando nao existem variaveis Supabase configuradas.
Para usar Supabase:

1. Crie o projeto no Supabase.
2. Abra `supabase_schema.sql`.
3. Copie o conteudo para Supabase Dashboard > SQL Editor.
4. Execute o SQL.
5. Copie `.env.example` para `.env`.
6. Preencha:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_BUCKET=documentos-utentes
```

Depois corra:

```powershell
python app.py
```

A `SUPABASE_SECRET_KEY` e secreta. Nunca deve ser enviada para GitHub, frontend,
screenshots ou mensagens partilhadas. No Vercel, configure esta chave apenas em
Environment Variables.

## Dados locais

A aplicacao local usa SQLite e cria o ficheiro:

```text
utentes.db
```

Os PDFs anexados ficam na pasta:

```text
anexos/
```

Estes ficheiros/pastas estao no `.gitignore` e nao devem ser enviados para o GitHub, porque podem conter dados sensiveis de utentes.

## Estrutura

```text
app.py                Aplicacao principal
logo-horizontal.png   Logotipo usado no cabecalho/login
README.md             Este ficheiro
.gitignore            Regras para nao publicar dados locais
.env.example          Exemplo de configuracao
supabase_schema.sql   Tabelas e bucket para Supabase
```

## Repositorio

Repositorio pretendido:

```text
https://github.com/Elvee24/Utentes-MenteMovimento
```
