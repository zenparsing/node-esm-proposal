import { $, asyncFS } from './util.js';

const resultsFile = $('data/package-results.json');

async function main() {
  let results = await load();
  let errors = results.filter(entry => entry.result !== 'ok');
  let unknownErrors = errors.filter(entry => entry.result === 'error');

  console.log('\n== Summary ==\n');
  console.log(`Total packages: ${ results.length }`);
  console.log(`Errors: ${ errors.length }`);
  console.log(`Unknown errors: ${ unknownErrors.length }`);
  console.log('\n');

  let groups = groupErrors(results);
  let groupCount = [...groups]
    .map(([key, items]) => [key, items.length])
    .sort((a, b) => b[1] - a[1]);

  console.log('== Results by type ==\n')
  groupCount.forEach(([key, count]) => console.log(`${ key }: ${ count }`));
  console.log('\n');

  let cjsImports = groupCjsImports(groups.get('Imports CJS'));
  let importCount = [...cjsImports].sort((a, b) => b[1] - a[1]).filter(item => item[1] > 1);

  console.log(`== Common CJS Imports ==\n`);
  importCount.forEach(([key, count]) => console.log(`${ key }: ${ count }`));
  console.log('\n');
}

function groupCjsImports(list) {
  let groups = new Map();

  for (let item of list) {
    let names = item.result.replace(/^[^\(]+\(|\).*$/g, '').split(/\s*,\s*/g);

    for (let key of names) {
      if (!groups.has(key)) {
        groups.set(key, 1);
      } else {
        groups.set(key, groups.get(key) + 1);
      }
    }
  }

  return groups;
}

function groupErrors(list) {
  let groups = new Map();

  for (let item of list) {
    let key = item.result.replace(/\s*\(.+/, '');
    if (!groups.has(key)) {
      groups.set(key, []);
    }

    let items = groups.get(key);
    items.push(item);
  }

  return groups;
}

main();

async function load() {
  return JSON.parse(await asyncFS.readFile(resultsFile, 'utf8'));
}

async function save(data) {
  await asyncFS.writeFile(resultsFile, JSON.stringify(data, null, 2));
}

// ## Cleaning helpers

async function fixReact() {
  let results = await load();

  results.forEach(entry => {
    let msg = entry.errorMessage || '';
    if (msg.includes('Error: Cannot find module react\n')) {
      entry.errorMessage = null;
      entry.result = "Imports CJS (react)";
    }
  });

  await save(results);
}

async function fixPackageJSON() {
  let results = await load();

  results.forEach(entry => {
    let msg = entry.errorMessage || '';
    if (/Unknown file extension: [\s\S]+\/package\.json/.test(msg)) {
      entry.errorMessage = null;
      entry.result = "Imports package.json";
    }
  });

  await save(results);
}

async function fixNoDefault() {
  let results = await load();

  results.forEach(entry => {
    let msg = entry.errorMessage || '';
    let m = /SyntaxError: The requested module '([^']+)' does not provide an export named 'default'/.exec(msg);
    if (m) {
      entry.errorMessage = null;
      entry.result = "Imports CJS (" + m[1] + ")";
    }
  });

  await save(results);
}

async function fixNoModule() {
  let results = await load();

  results.forEach(entry => {
    let msg = entry.errorMessage || '';
    let m = /Error: Cannot find module ([a-zA-Z0-9_-]+)/.exec(msg);
    if (m) {
      entry.errorMessage = null;
      entry.result = "Imports CJS (" + m[1] + ")";
    }
  });

  await save(results);
}

async function fixBrowser() {
  let results = await load();

  results.forEach(entry => {
    let msg = entry.errorMessage || '';
    if (msg.includes('window is not defined')) {
      entry.errorMessage = null;
      entry.result = "Browser only";
    }
  });

  await save(results);
}
