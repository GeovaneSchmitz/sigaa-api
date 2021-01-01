const Sigaa = require('sigaa-api').Sigaa;

const fs = require('fs');
const path = require('path');

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});
// Pasta para salvar os arquivos
const BaseDestiny = path.resolve('.', 'downloads');

// coloque seu usuário
const username = '';
const password = '';

// cria a pasta de downloads
fs.mkdir(BaseDestiny, (err) => {
  if (err && err.code !== 'EEXIST') throw new Error('up');
});

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
    const files = await course.getFiles(); // Pega todos arquivo da turma
    if (files.length !== 0) {
      // Se a turma tiver arquivos

      // Concatena o diretório de downloads com o semestre da turma
      const pathPeriod = path.join(BaseDestiny, course.period);
      // Cria uma pasta para o semestre
      await fs.promises.mkdir(pathPeriod).catch((err) => {
        if (err && err.code !== 'EEXIST') console.error(err);
      });

      // Concatena o diretório do semestre com o nome da turma
      const pathCourse = path.join(pathPeriod, course.title);
      // Cria uma pasta para a turma dentro da pasta do semestre
      await fs.promises.mkdir(pathCourse).catch((err) => {
        if (err && err.code !== 'EEXIST') console.error(err);
      });

      for (const file of files) {
        console.log('Nome do arquivo:' + file.title); // Os arquivos também podem ter descrição
        const filepath = await file
          .download(pathCourse, (bytesDownloaded) => { // Faz o download do arquivo
            const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB';
            process.stdout.write('Progresso: ' + progress + '\r'); // O process.stdout.write é usado apenas para reutilizar a mesma linha
          })
          .catch((err) => {
            console.error(err);
          });
        console.log('Salvado em: ' + filepath);
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
