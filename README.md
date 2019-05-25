# SIGAA-API
Uma biblioteca para nodejs, com finalidade de poder acessar recursos do SIGAA, mesmo que sua instuição não tenha um api publica.

# Disclamer
Eu sou estudante do IFSC, onde desenvolvo este projeto em tempo livre, por causa disto esta API não oferece suporte para qualquer outro tipo de conta além de estudante.

# Exemplos
Existe alguns exemplos de uso, você pode ver na pasta examples, como: 
* Listar suas turmas
* Ver suas notas
* Baixar todos os arquivos disponibilizado pelos seus professores
* Ver as noticias publicas nas turmas
## Para executar:
* Instalar o nodejs e instalar as dependências do pacote
* Você precisa trocar a urlBase para site do sigaa da sua instituição:
```javascript
const sigaa = new Sigaa ({
  urlBase: 'https://sigaa.ifsc.edu.br'
});
```
* Preencher com seu usuário e senha do sigaa
```javascript
// put your crendecias
var username = 'usuario';
var password = 'senha';
```
* Executar o arquivo com o nodejs
