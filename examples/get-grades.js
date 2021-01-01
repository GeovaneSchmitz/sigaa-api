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
    // Pega as notas
    const gradesGroups = await course.getGrades();
    for (const gradesGroup of gradesGroups) {
      console.log('->' + gradesGroup.name);
      switch (
        gradesGroup.type //Existem 3 tipos de grupos de notas
      ) {
        // O primiro tipo é somente o valor final, mesmo assim, pode ser que o valor ainda seja indefinido
        case 'only-average':
          console.log(gradesGroup.value);
          break;
        // O segundo é um grupo com notas ponderadas (tem peso), mas os pesos podem serem todos iguais
        case 'weighted-average':
          //Para cada nota do grupo
          for (const grade of gradesGroup.grades) {
            console.log('-' + grade.name);
            // O peso dessa nota
            console.log('peso: ' + grade.weight);
            // O valor dessa nota pode ser também indefinido
            console.log(grade.value);
          }

          // A média final do grupo
          console.log('média:' + gradesGroup.value);

          break;
        // O Terceiro é um grupo de soma de notas, não tem peso, mas cada nota tem um valor máximo

        case 'sum-of-grades':
          //Para cada nota do grupo
          for (const grade of gradesGroup.grades) {
            console.log('-' + grade.name);
            // O valor máximo dessa nota
            console.log('Valor máximo: ' + grade.maxValue);
            // O valor dessa nota pode ser também indefinido
            console.log(grade.value);
          }

          // A soma final do grupo
          console.log('soma:' + gradesGroup.value);
          break;
      }
    }
    console.log(''); // Para espaçar as linhas
  }
  // Encerra a sessão
  await account.logoff();
};

main().catch((err) => {
  if (err) console.log(err);
});
