import { $, fetch, asyncFS, asyncChildProcess } from './util.js';

const getPackageJSON = import.meta.require('package-json');
const ProgressBar = import.meta.require('progress');

async function createDir(dir) {
  if (!await asyncFS.exists(dir)) {
    await asyncFS.mkdir(dir);
  }
}

async function filterPackages(names) {
  let list = [];
  let bar = new ProgressBar('[:bar] :percent :packageName', {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: names.length,
  });

  console.log(`Searching for packages that have a "module" key`);
  for (let name of names) {
    bar.tick({ packageName: name });
    try {
      let metadata = await getPackageJSON(name, { fullMetadata: true });
      if (typeof metadata.module === 'string') {
        list.push(name);
      }
    } catch {}
  }

  return list;
}

async function getPeerDependencies(name) {
  let { peerDependencies = {} } = await getPackageJSON(name, { fullMetadata: true });
  return Object.keys(peerDependencies);
}

const packageListURL = 'http://anvaka.github.io/npmrank/online/npmrank.json';

async function main() {
  let skipErrors = process.argv.includes('--skip-errors');

  await createDir($('_temp'));
  await asyncFS.writeFile($('_temp/package.json'), JSON.stringify({}, null, 2));

  let nameFile = $('data/package-names.json');
  let names;

  if (await asyncFS.exists(nameFile)) {
    names = JSON.parse(await asyncFS.readFile(nameFile, 'utf8'));
  } else {
    console.log(`Downloading list from ${ packageListURL }`);
    let response = await fetch(packageListURL);
    let data = await response.json();
    names = Object.keys(data.rank).sort((a, b) => parseFloat(data.rank[b]) - parseFloat(data.rank[a]));
    names = await filterPackages(names);
    await asyncFS.writeFile(nameFile, JSON.stringify(names));
  }

  console.log(`Found ${ names.length } package names`);

  let resultsFile = $('data/package-results.json');
  let results;

  if (await asyncFS.exists(resultsFile)) {
    results = JSON.parse(await asyncFS.readFile(resultsFile, 'utf8'));
  } else {
    console.log(`Generating new results file`);
    results = names.map(name => ({ name, result: null, keys: null }));
  }

  let count = 0;

  for (let entry of results) {
    count += 1;

    if (entry.result && (skipErrors || entry.result !== 'error')) {
      continue;
    }

    let installs = [...await getPeerDependencies(entry.name), entry.name];

    console.log(`Installing [${ installs.join(', ') }] ${ count }/${ results.length } `);

    await asyncChildProcess.exec(`npm install`, { cwd: $('_temp') });

    await Promise.all([
      asyncChildProcess.exec(`npm install --no-package-lock --ignore-scripts --no-save ${ installs.join(' ') }`, {
        cwd: $('_temp'),
      }),
      asyncFS.writeFile($('_temp/index.js'), `
        import * as ns from ${ JSON.stringify(entry.name) };
        console.log(JSON.stringify(Object.keys(ns)));
      `)
    ]);

    console.log(`Testing namespace import`);

    try {

      let output = await asyncChildProcess.exec(`knode --experimental-modules -m ./`, {
        cwd: $('_temp'),
      });

      let namespaceKeys = JSON.parse(output.stdout);

      console.log(`Found ${ namespaceKeys.length } exports`);

      if (namespaceKeys.length === 0) {
        throw new Error('No namespace keys exported');
      }

      entry.result = 'ok';
      entry.keys = namespaceKeys;

      await asyncFS.writeFile(resultsFile, JSON.stringify(results, null, 2));

    } catch (err) {

      if (!skipErrors) {
        throw err;
      }

      entry.result = 'error';
      entry.errorMessage = err.message;
    }

    await asyncFS.writeFile(resultsFile, JSON.stringify(results, null, 2));
  }
}

main();
