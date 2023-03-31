import { spawn } from 'node:child_process'

import processGitData from './git.js'

const defaultConfig = {
  execOptions: {},
  logProcess: true
}

export async function spawnGit(args, cmdConfig = {}) {
  const { getOutput, printProgress } = processGitData()

  return new Promise((resolve, reject) => {
    if (!args.length) {
      return reject("No arguments were given");
    }

    let [ gitCmd, clone_url, localDir ] = args

    cmdConfig = {...defaultConfig, ...cmdConfig};

    if (cmdConfig.logProcess) {
      const message = cmdConfig.customMsg ? `${cmdConfig.customMsg}...` : `git ${gitCmd} \x1b[92m${clone_url}\x1b[0m ...`;
      console.log('\x1b[36m%s\x1b[0m', message);
    }

    const commandExecuter = spawn('git', args, cmdConfig.execOptions);
    let stdOutData = '';
    let stderrData = '';

    commandExecuter.stdout.on('data', (data) => {
      let output = getOutput(data)

      if ('string' !== typeof output) {
        let { status, percent, done } = output
        printProgress(status, percent, done, localDir)
      } else {
        // console.log('spawngit stdout', output)
      }

      return stdOutData += data
    });
    commandExecuter.stderr.on('data', (data) => {
      let output = getOutput(data)

      if ('string' !== typeof output) {
        let { status, percent, done } = output
        printProgress(status, percent, done, localDir)
      } else {
        // console.log('spawngit stderr', output)
      }

      return stderrData += data
    });
    commandExecuter.on('close', (code) => {
      let err = stderrData.toString()
      let out = stdOutData.toString()

      if (cmdConfig.logProcess) {
        process.stdout.write(`\n`);
      }

      const message = cmdConfig.customMsg ?
        `${cmdConfig.customMsg}...` :
        `${gitCmd} \x1b[92m${clone_url}\x1b[0m to \x1b[96m${localDir}\x1b[0m directory`;

      if (cmdConfig.logProcess) {
        if (code != 0) {
          console.warn('\x1b[0m%s\x1b[0m', message);
          console.error('\x1b[91m%s\x1b[0m', err);
        } else {
          console.log('\x1b[0m%s\x1b[0m', message);
        }
      }

      return code != 0 ? reject(err) : resolve(clone_url)
    });
  })
}
