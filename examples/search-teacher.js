const Sigaa = require('..')

const sigaa = new Sigaa({
  url: 'https://sigaa.ifsc.edu.br'
})

const searchTerm = ''

const searchTeacher = sigaa.search.teacher()
async function main () {
  try {
    const campusList = await searchTeacher.getCampusList()
    console.log(campusList)

    const campus = campusList.find(campus => campus.name.includes('FLN')) // search in campus FLN

    const results = await searchTeacher.search(searchTerm, campus)

    for (const result of results) {
      const email = await result.getEmail()
      console.log(result.name)
      console.log(result.department)
      console.log(result.pageURL)
      console.log(result.photoURL)
      console.log(email)
    }
  } catch (err) {
    console.log(err)
  }
}

main()
