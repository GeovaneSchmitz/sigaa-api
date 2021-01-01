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
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
