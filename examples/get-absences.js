const Sigaa = require('sigaa-api').Sigaa;

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});

// coloque seu usuário
const username = '';
const password = '';

const main = async () => {
  const account = await sigaa.login(username, password); // login

  /**
   * O usuário pode ter mais de um vínculo
   * @see https://github.com/GeovaneSchmitz/sigaa-api/issues/4
   **/
  const bonds = await account.getBonds();

  //Para cada vínculo
  for (const bond of bonds) {
    if (bond.type !== 'student') continue; // O tipo pode ser student ou teacher

    //Se o tipo do vínculo for student, então tem matrícula e curso
    console.log('Matrícula do vínculo: ' + bond.registration);
    console.log('Curso do vínculo: ' + bond.program);

    // Se for usado bond.getCourses(true); todas as turmas são retornadas, incluindo turmas de outros semestres
    const courses = await bond.getCourses();

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
  }
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
