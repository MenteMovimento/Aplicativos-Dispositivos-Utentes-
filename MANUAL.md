# Manual de utilizacao

## 1. Entrar no sistema

1. Abre o site da Vercel.
2. Entra com o email e palavra-passe criados no Supabase.
3. Se ja tiveres sessao ativa, o site abre diretamente no painel.
4. Se o email ja existir, usa `Entrar` em vez de criar outra conta.
5. Se aparecer limite de emails, aguarda o cooldown antes de pedir novo email de confirmacao.
6. Todos os utilizadores autenticados conseguem gerir dispositivos.
7. Usa o seletor `PT/EN` para mudar o idioma e o botao de lua/sol para alternar tema claro ou escuro.

## 2. Criar um dispositivo

1. No painel `Novo dispositivo`, preenche pelo menos `ID`, `Modelo` e `Nº Série`.
2. Completa as secoes `Identificação`, `Hardware e sistema`, `Diagnóstico e reparação`, `Configuração e contas`.
3. Clica em `Adicionar dispositivo`.

## 3. Editar ou desativar

1. Na tabela, clica no icone de lapis da linha.
2. Altera os campos necessarios.
3. Clica em `Guardar alterações`.
4. Para deixar desativo, escreve `Arquivado` ou `Abate` no campo `Estado`.
5. Ao editar um dispositivo, usa `Anexar foto/fatura` para guardar fotografias, PDFs ou faturas.
6. O painel `Historico` mostra as principais alteracoes desse dispositivo.

## 4. Importar do Google Sheets

1. No Google Sheets, vai a `Ficheiro > Transferir > Valores separados por virgulas (.csv)`.
2. No site, clica em `Importar CSV`.
3. Escolhe o ficheiro CSV.
4. A importacao usa o `Nº Série` para atualizar dispositivos existentes sem duplicar.

## 5. Exportar para Google Sheets

1. Clica em `Exportar CSV`.
2. Abre ou importa o ficheiro no Google Sheets.
3. Se usares pesquisa ou filtro antes de exportar, so os registos visiveis sao exportados.
4. Usa `Ordenar por` e `Direcao` para exportar na ordem crescente ou decrescente que estiver visivel.
5. Usa `Imprimir relatorio` para gerar um relatorio imprimivel dos registos visiveis.

## 6. Ver estatisticas

1. Abre a aba `Estatisticas`.
2. Consulta totais por estado, marcas mais comuns, tecnicos, avarias e resultados finais.
3. Tambem podes imprimir um relatorio a partir desta pagina.

## 7. Apagar registos

1. Para apagar uma linha, usa o icone vermelho de lixo nessa linha.
2. Para apagar tudo, usa `Apagar tudo`.
3. O sistema pede confirmacao e exige escrever `APAGAR`.
4. Depois de apagar tudo, nao ha recuperacao automatica. Exporta CSV antes se precisares de copia.

## 8. Gerir utilizadores

1. Entra com uma conta confirmada.
2. Abre a aba `Utilizadores`.
3. Em `Criar utilizador`, preenche nome, email e palavra-passe temporaria.
4. Clica em `Criar utilizador` e entrega o email/palavra-passe ao colega.
5. A conta nova fica automaticamente como `Administrador`.
6. Na tabela de utilizadores, usa o lapis para alterar o nome.
7. Usa o seletor para mudar a permissao mais tarde.
8. Usa o lixo vermelho para eliminar uma conta que ja nao deve aceder ao site.
9. Nao podes eliminar a tua propria conta nem alterar a tua propria permissao, para evitares perder acesso ao painel.

## 9. Ativar anexos e historico no Supabase

1. Abre o SQL Editor no Supabase.
2. Executa o ficheiro `supabase/feature-upgrades.sql`.
3. Volta ao site, faz `Ctrl + F5` e edita um dispositivo para usar anexos e historico.
