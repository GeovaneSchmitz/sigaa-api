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
          // O nome do arquivo no sistema, pode ser diferente do nome do arquivo baixado
          console.log('Nome do arquivo:' + file.title);
          // O arquivo também pode ter descrição (file.description)

          // Faz o download do arquivo, quando terminar o download retona o diretório onde foi salvo
          const filepath = await file
            .download(pathCourse, (bytesDownloaded) => {
              // O callback é apenas para saber o progresso do download
              const progress = Math.trunc(bytesDownloaded / 10) / 100 + 'kB';
              process.stdout.write('Progresso: ' + progress + '\r'); // O process.stdout.write é usado apenas para reutilizar a mesma linha
            })
            .catch((err) => {
              console.error(err);
            });
          //filepath é o diretório onde foi salvo o arquivo
          console.log('Salvado em: ' + filepath);
          console.log('');
        }
        console.log('');
      }
    }
    if (bonds.length === 0) {
      console.log('O usuário não tem nenhum vínculo.');
    }
  }

  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
