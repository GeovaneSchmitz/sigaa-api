const Sigaa = require('sigaa-api').Sigaa;

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
});

const searchTerm = 'José'; // Nome do professor para procurar

const searchTeacher = sigaa.search.teacher();
async function main() {
  try {
    /**
     * Retorna a lista de campus, você não precisa usar,
     * mas se você quiser filtrar os resultados para um
     * campus específico você pode.
     **/

    const campusList = await searchTeacher.getCampusList();
    console.log('Lista de campus');
    console.table(campusList);

    const campus = campusList.find((campus) => campus.name.includes('FLN')); // Procurar pelo primeiro campus que tenha no nome FLN

    const results = await searchTeacher.search(searchTerm, campus);

    for (const result of results) {
      const email = await result.getEmail();
      console.log('Nome: ' + result.name);
      console.log('Departamento: ' + result.department);
      console.log('Página: ' + result.pageURL.href);

      //Se você quiser baixar você pode usar result.downloadProfilePicture(localParaSalvar)
      console.log(
        'Link da foto: ' +
          (result.profilePictureURL ? result.profilePictureURL.href : undefined)
      );
      console.log('E-Mail: ' + email);
      console.log('');
    }
  } catch (err) {
    console.log(err);
  }
}

main();
