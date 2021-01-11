/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const babelConfig = require('./babel.config.json');

const dist = path.resolve('./dist');

const getPathMapping = () => {
  return babelConfig.plugins.find(
    (plugin) => plugin[0] === 'module-resolver'
  )[1].alias;
};

const pathMapping = getPathMapping();
const parserDir = (dirpath) =>
  fs.promises.readdir(dirpath, { withFileTypes: true }).then((files) => {
    for (let file of files) {
      const filepath = path.resolve(dirpath, file.name);
      if (file.isDirectory()) parserDir(filepath);
      //match main files .d.ts
      else if (file.name.match(/d\.ts$/)) {
        fs.promises
          .readFile(filepath, { encoding: 'utf8' })
          .then((fileContent) => {
            const findPaths = Object.keys(pathMapping);
            for (const find of findPaths) {
              const newPath = path.relative(
                dirpath,
                path.resolve(pathMapping[find].replace(/src/g, 'dist'))
              );
              fileContent = fileContent.replace(
                new RegExp(`from '\\${find}`, 'g'),
                `from '${newPath.charAt(0) === '.' ? '' : './'}${newPath}` //Adiciona ./ se o path não começar com .
              );
            }
            fs.promises.writeFile(filepath, fileContent);
          });
      }
    }
  });

parserDir(dist);
