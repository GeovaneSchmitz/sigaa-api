const { Sigaa } = require('sigaa-api');

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});

// Ou

const sigaa = new Sigaa({
  url: 'https://sigaa.ufpb.br',
  institution: 'UFPB' // esta propriedade indica a instituição, o padrão é IFSC, mas pode ser UFPB também
});

// Se você quiser suporte a outra instituição, você pode testar com o padrão IFSC ou UFPB e abrir um issue com o erro gerado.
