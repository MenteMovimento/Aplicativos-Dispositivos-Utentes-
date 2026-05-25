# Manual de utilizacao

## 1. Entrar no sistema

1. Abre o site da Vercel.
2. Entra com o email e palavra-passe criados no Supabase.
3. Contas `Administrador` e `Gestor` podem criar, editar, importar, exportar e apagar dispositivos.
4. Contas `Membro` conseguem consultar, mas nao alterar dados.

## 2. Criar um dispositivo

1. No painel `Novo dispositivo`, preenche pelo menos `ID`, `Modelo` e `Nº Série`.
2. Completa as secoes `Identificação`, `Hardware e sistema`, `Diagnóstico e reparação`, `Configuração e contas`.
3. Clica em `Adicionar dispositivo`.

## 3. Editar ou desativar

1. Na tabela, clica no icone de lapis da linha.
2. Altera os campos necessarios.
3. Clica em `Guardar alterações`.
4. Para deixar desativo, escreve `Arquivado` ou `Abate` no campo `Estado`.

## 4. Importar do Google Sheets

1. No Google Sheets, vai a `Ficheiro > Transferir > Valores separados por virgulas (.csv)`.
2. No site, clica em `Importar CSV`.
3. Escolhe o ficheiro CSV.
4. A importacao usa o `Nº Série` para atualizar dispositivos existentes sem duplicar.

## 5. Exportar para Google Sheets

1. Clica em `Exportar CSV`.
2. Abre ou importa o ficheiro no Google Sheets.
3. Se usares pesquisa ou filtro antes de exportar, so os registos visiveis sao exportados.

## 6. Apagar registos

1. Para apagar uma linha, usa o icone vermelho de lixo nessa linha.
2. Para apagar tudo, usa `Apagar tudo`.
3. O sistema pede confirmacao e exige escrever `APAGAR`.
4. Depois de apagar tudo, nao ha recuperacao automatica. Exporta CSV antes se precisares de copia.

## 7. Gerir utilizadores

1. Entra com uma conta `Administrador`.
2. Abre a aba `Utilizadores`.
3. Em `Criar utilizador`, preenche nome, email, palavra-passe temporaria e permissao.
4. Escolhe `Administrador`, `Gestor` ou `Membro` antes de criar.
5. Clica em `Criar utilizador` e entrega o email/palavra-passe ao colega.
6. Na tabela de utilizadores, podes mudar a permissao mais tarde.
7. A tua propria permissao fica bloqueada para evitares perder acesso de administrador.
