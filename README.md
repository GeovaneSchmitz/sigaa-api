# Disclaimer
Eu sou estudante do IFSC, onde desenvolvo este projeto em tempo livre, por causa disto esta API não oferece suporte para qualquer outro tipo de conta além de estudante.
Ela está em fase inicial e não possui todas as funcionalidades do SIGAA, e ela pode sofrer mudanças complexas, leve em consideração antes de usar no seu projeto.

# Exemplos
Existe alguns exemplos de uso, você pode ver na pasta examples, como: 
* Listar suas turmas
* Ver suas notas
* Baixar todos os arquivos disponibilizado pelos seus professores
* Ver as noticias publicas nas turmas

## Para executar:
* Instalar o nodejs e instalar as dependências do pacote
* Você precisa dizer a url do sigaa da sua instituição:
```javascript
const sigaa = new Sigaa ({
  url: 'https://sigaa.ifsc.edu.br'
});
```
* Preencher com seu usuário e senha do sigaa
```javascript
// put your crendecias
const username = 'usuario';
const password = 'senha';
```
* Executar o arquivo com o nodejs