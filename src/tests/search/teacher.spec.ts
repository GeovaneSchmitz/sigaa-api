import { SigaaSearchTeacherResult } from '@search/sigaa-search-teacher-result';
import { Sigaa } from '@session/../sigaa-root';
import { URL } from 'url';


test('if sigaa search loads campus list', async () => {
  const sigaa = new Sigaa({
    url: 'https://sigaa.ifsc.edu.br'
  });
  const list = await sigaa.sigaaSearch.teacher().getCampusList();
  for (const campus of list) {
    expect(campus.name).toMatch(
      /CAMPUS|INSTITUTO|COORDENADORIA|DIRETORIA|TODOS/g
    );
    expect(campus.name).toMatch(/^([A-Z]|[0-9]|[ÁÉÓÍÚÃÇÂÊÎÔÛ. \-()])+$/);
    expect(campus.value).toMatch(/^[0-9]+$/g);
  }
}, 30000);

test('if sigaa search returns results', async () => {
  const sigaa = new Sigaa({
    url: 'https://sigaa.ifsc.edu.br'
  });
  const list = await sigaa.sigaaSearch.teacher().search('José');
  for (const teacher of list) {
    expect(teacher).toBeInstanceOf(SigaaSearchTeacherResult);
    expect(teacher.name).toMatch(/^([A-Z]|[ÁÉÓÍÚÃÇÂÊÎÔÛ ])+$/);
  }
}, 30000);

test('if sigaa search returns emails', async () => {
  const sigaa = new Sigaa({
    url: 'https://sigaa.ifsc.edu.br'
  });
  const list = (await sigaa.sigaaSearch.teacher().search('José')).slice(0, 5);
  expect(list.length).toBe(5);
  for (const teacher of list) {
    expect(teacher).toBeInstanceOf(SigaaSearchTeacherResult);
    const email = await teacher.getEmail();
    let someEmail;
    switch (typeof email) {
      case 'string':
        someEmail = email;
        expect(email).toMatch(/[^@]+@(aluno\.)?ifsc\.edu\.br/g);
        break;
      default:
        expect(email).toBeNull();
    }
    expect(someEmail).toMatch(/[^@]+@(aluno\.)?ifsc\.edu\.br/g);
  }
}, 300000);

test('if sigaa search returns profile picture url', async () => {
  const sigaa = new Sigaa({
    url: 'https://sigaa.ifsc.edu.br'
  });
  const list = (await sigaa.sigaaSearch.teacher().search('José')).slice(0, 10);
  for (const teacher of list) {
    expect(teacher).toBeInstanceOf(SigaaSearchTeacherResult);
    const profilePictureURL = await teacher.profilePictureURL;
    if (profilePictureURL) {
      expect(profilePictureURL).toBeInstanceOf(URL);
      expect(profilePictureURL.href).toMatch(/[\s\S]+?verFoto?[\s\S]+?/g);
    } else {
      expect(profilePictureURL).toBeNull;
    }
  }
}, 300000);
