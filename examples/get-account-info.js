const Sigaa = require('sigaa-api').Sigaa;

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});

// coloque seu usuário
const username = '';
const password = '';

const main = async () => {
  const account = await sigaa.login(username, password); // login

  console.log("> Nome: "+ await account.getName());
  console.log("> Url foto: "+ await account.getProfilePictureURL());
  
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
