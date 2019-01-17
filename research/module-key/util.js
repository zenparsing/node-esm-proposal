import * as FS from 'fs';
import * as Path from 'path';
import { promisify } from 'util';
import * as ChildProcess from 'child_process';
import fetch from 'node-fetch';

const getPackageJSON = import.meta.require('package-json');
const ProgressBar = import.meta.require('progress');

function promiseAdapter(ns) {
  return new Proxy({}, {
    get(target, key) { return promisify(ns[key]); }
  });
}

export function $(path) {
  return Path.resolve(import.meta.dirname, path);
}

export { fetch };
export const asyncFS = promiseAdapter(FS);
export const asyncChildProcess = promiseAdapter(ChildProcess);
