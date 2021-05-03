const { Sigaa } = require('sigaa-api');

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
  const bonds = await account.getActiveBonds();

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
      console.log(course.title);
      const homeworkList = await course.getHomeworks();
      for (const homework of homeworkList) {
        console.log(homework.title);
        try {
          // Pode gerar um erro se a tarefa não tem arquivo ou se você já enviou a resposta para a tarefa
          // E para baixar o arquivo é a mesma coisa do exemplo download-all-files file.download(caminho)
          const file = await homework.getAttachmentFile();
          console.log(file.title);
        } catch (err) {
          console.log(err.message);
        }
        console.log(await homework.getDescription());

        // Uma marcador (verdadeiro ou falso) que indica se a tarefa vale nota
        console.log(
          (await homework.getHaveGrade()) ? 'Vale nota' : 'Não vale nota'
        );

        // A data de início para envio da tarefa
        console.log('Data de início: ' + homework.startDate);

        // A data de termino para envio da tarefa
        console.log('Data de início: ' + homework.endDate);
        console.log('');
      }
      console.log('');
    }
  }

  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
