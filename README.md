## SIGAA-API
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/1ed3e89858204acdb2307febc87da74c)](https://www.codacy.com/gh/GeovaneSchmitz/sigaa-api/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=GeovaneSchmitz/sigaa-api&amp;utm_campaign=Badge_Grade)


Uma biblioteca de Web Scraping, para acessar o SIGAA (Sistema Integrado de Gestão de Atividades Acadêmicas), ela é a API mais completa disponível no Github. Tem suporte a vários recursos, desde notas, notícias e informações das turmas, até download de arquivos, foto de perfil e E-mail.

Atualmente, ela já foi testada no IFSC (Instituto Federal de Santa Catarina) e na UFPB (Universidade Federal da Paraíba).

Caso precise de suporte para alguma instituição ou algum recurso, não se acanhe, você será bem atendido. ;-)

### O que ela já faz
 Embora não seja oficial, permite o acesso a vários itens: 
  * Listar suas turmas
  * Ver suas faltas e notas
  * Alterar a sua senha
  * Ver a sua foto de perfil, de seus colegas e seus professores
  * Ver os membros da turmas
  * Procurar por docentes pelo nome ou pelo campus
  * Baixar todos os arquivos disponibilizado pelos seus professores
  * Ver as noticias publicadas nas turmas
  * Ver os planos de ensinos, atendimento, referências bibliográficas, etc

### Caso de uso
Ela é usada em um [bot](https://github.com/GeovaneSchmitz/SIGAA-telegram-integration) para o telegram.

### Como usar:
  * Instalar o nodejs;
  * Criar um projeto com o node, pode ser feito com `npm init`;
  * Instalar este pacote como dependência `npm install sigaa-api` ou `yarn add sigaa-api`;
  * Escrever algum script, você pode ver alguns exemplos [aqui](https://github.com/GeovaneSchmitz/sigaa-api/tree/master/examples) ou ver a [documentação](https://geovaneschmitz.github.io/sigaa-api/);
  * Executar o seu script com o nodejs.
