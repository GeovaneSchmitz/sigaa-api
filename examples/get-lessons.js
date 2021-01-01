const Sigaa = require('sigaa-api').Sigaa;

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});

// coloque seu usuário
const username = '';
const password = '';

const main = async () => {
  const accounts = await sigaa.login(username, password); // login
  let account;
  if (accounts[0] && accounts[0].userType === 'student') {
    account = accounts[0]; // O usuário pode ter tanto acesso ao portal do aluno quanto ao do professor
  } else {
    throw new Error('O usuário não é um aluno.');
  }
  // Se for usado account.getCourses(true); todas as turmas são retornadas, incluindo turmas de outros semestres
  const courses = await account.getCourses();

  // Para cada turma
  for (const course of courses) {
    console.log(' > ' + course.title);
    // Pega as aulas
    const lessons = await course.getLessons();
    for (const lesson of lessons) {
      console.log('->' + lesson.title);
      console.log(lesson.startDate.toString());
      console.log(lesson.endDate.toString());
      console.log(lesson.contentText);
      for (const attachment of lesson.attachments) {
        console.log('tipo de anexo: ' + attachment.type); // Cada tipo de anexo tem suas opções
        console.log('Nome do anexo: ' + attachment.title);
      }
      console.log(''); // Para espaçar as linhas
    }
    console.log(''); // Para espaçar as linhas
  }
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
