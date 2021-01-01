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
    // Pega as faltas
    const absencesCourse = await course.getAbsence();
    console.log('Número máximo de faltas: ' + absencesCourse.maxAbsences);
    console.log('Número total de faltas: ' + absencesCourse.totalAbsences);
    // absencesCourse.list é um objeto com a data e quantidade de faltas no dia
    console.table(absencesCourse.list);
  }
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
