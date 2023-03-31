#!/usr/bin/env -S node --no-warnings

process.removeAllListeners('warning')
process.on('SIGTERM', () => process.exit());
process.on('SIGINT', () => process.exit());

import pkg from '../package.json' assert { type: 'json' }

import { spawnGit } from '../lib/spawn.js'
import {
  github, gitlab,
} from '../lib/api.js'
import { queue } from '../lib/queue.js'
import {
  containsAny, chunkSubstr, removeItems, captureItems,
  regexUrlGit, regexUrlGithublab, regexUrlDomain
} from '../lib/helpers.js'

const INDENT = '  '

let args = process.argv.slice(2).filter(
  arg => '-c' !== arg
)

// const PARAMS = {
//   BASE_DIR: captureItems(args, ['-d', '--directory'], '=')
// }
const FLAGS = {
  NONE: !containsAny(args, [
    // all of the possible filter flags
    '-a', '--all', '-s', '--sources', '-m', '--mirrors', '-f', '--forks'
  ]),
  ALL: removeItems(args, ['-a', '--all']),
  SOURCES: removeItems(args, ['-s', '--sources']),
  MIRRORS: removeItems(args, ['-m', '--mirrors']),
  FORKS: removeItems(args, ['-f', '--forks']),
  ONLY_ONE: removeItems(args, ['-o', '--one', '--only']),
  VERBOSE: removeItems(args, ['-V', '--verbose']),
}
if (FLAGS.NONE) {
  FLAGS.SOURCES = FLAGS.NONE
}

let {
  name: APP_NAME,
  description: APP_DESCRIPTION,
  homepage: APP_URL,
  repository: { url: APP_REPO, },
  version: APP_VERSION,
  bin: APP_BINS
} = pkg

APP_BINS = Object.keys(APP_BINS)

let APP_NS = new URL(APP_REPO)
let APP_PATH = APP_NS.pathname.substring(1).split('.git')[0]
let [APP_OWNER] = APP_PATH.split('/')

async function main() {
  // console.info('args', args)
  // console.warn('FLAGS', FLAGS)

  let opQueue = queue()

  try {
    let url = new URL(args[0])
    let path = url.pathname.substring(1).split('.git')[0]
    let [user, repo] = path.split('/')
    let operations = []
    let cleanList = []
    let cloneNames = []
    let repoList
    let confineResult

    if (
      !FLAGS.ONLY_ONE && regexUrlGithublab.test(url.toString())
    ) {
      if (
        user &&
        url.host.endsWith('github.com')
      ) {
        if (url.host.endsWith('gist.github.com')) {
          repoList = await github.getBits(user, repo)
        } else {
          repoList = await github.listRepos(user)
        }
        confineResult = github.confineResult
      } else if (
        url.host.endsWith('gitlab.com')
      ) {
        if (user === 'snippets') {
          repoList = await gitlab.getBits(repo)
        } else {
          repoList = await gitlab.listRepos(user)
        }
        confineResult = gitlab.confineResult
      }
    }

    if (repoList?.length > 0) {
      repoList?.forEach(res => {
        let repo = confineResult(res)

        if (
          FLAGS.ALL ||
          (FLAGS.MIRRORS && repo.mirror_url !== null) ||
          (FLAGS.FORKS && repo.fork) ||
          (FLAGS.SOURCES && !repo.fork)
        ) {

          cloneNames.push(
            repo.name ||
            (repo.files && `${repo.id}: ${Object.keys(repo.files)[0]}`) ||
            repo.id
          )

          cleanList.push(repo)

          let opq = opQueue.enqueue(async () => spawnGit([
            'clone',
            repo.clone_url,
            repo.full_name,
            '--progress'
          ], { logProcess: FLAGS.VERBOSE }))

          operations.push(opq)
        }
      })

      console.info(
        `Attempting to \x1b[95m${APP_BINS[0]}\x1b[93m ${cleanList?.length}\x1b[0m repositories from \x1b[94mhttps://${url.host}/\x1b[0m\x1b[92m${user}\x1b[0m`
      )

      console.info(
        `  \x1b[36m${cloneNames.join(`\n${INDENT.repeat(1)}`)}\x1b[0m\n`
      )
    } else if (regexUrlGit.test(url.toString())) {
      operations.push(
        opQueue.enqueue(
          async () => spawnGit([
            'clone',
            url.toString(),
            path,
            '--progress'
          ], { logProcess: FLAGS.VERBOSE })
        )
      )

      console.info(
        `Attempting to \x1b[95m${APP_BINS[0]}\x1b[93m one\x1b[0m repository from \x1b[94mhttps://${url.host}/\x1b[0m\x1b[92m${user}\x1b[0m`
      )

      console.info(
        `  \x1b[36m${INDENT.repeat(1)}${repo}\x1b[0m\n`
      )
    }

    let allDone = await Promise.allSettled(operations)
    let cloneSuccess = 0
    let cloneFail = 0

    allDone.forEach(({ status, reason }) => {
      if ('rejected' === status) {
        return cloneFail += 1
      }

      cloneSuccess += 1
    })

    if (FLAGS.VERBOSE) {
      console.log('result', url.toString(), allDone)
    }

    console.info(
      `\x1b[95m${APP_BINS[0]}\x1b[0m cloned \x1b[94m${cloneSuccess}\x1b[0m repositories succesfully.`
    )

    if (cloneFail > 0) {
      console.info(`  \x1b[93m${cloneFail} repositories failed to clone.\x1b[0m`)
    }
  } catch (err) {
    console.error(`\x1b[91mfetch/clone error\x1b[0m`, err, err.code, args)
  }
}

const VERSION_INFO = `\x1b[1m${APP_NAME}\x1b[0m \x1b[92mv${APP_VERSION}\x1b[0m`

const HELP_INFO =
`${VERSION_INFO}
  \x1b[2m${chunkSubstr(APP_DESCRIPTION, 63).join(`\n${INDENT.repeat(1)}`)}\x1b[0m

  \x1b[94m\x1b[4m${APP_URL}\x1b[0m

\x1b[11m${'USAGE:'}\x1b[0m
  \x1b[11m${APP_BINS[0]}\x1b[0m \x1b[95m${'<repository_url> | <repository_user_or_organization>'}\x1b[0m

    \x1b[2m${APP_BINS[0]} ${APP_REPO}\x1b[0m

    \x1b[2m${APP_BINS[0]} ${APP_NS.origin}/${APP_OWNER}\x1b[0m

\x1b[11m${'OPTIONS:'}\x1b[0m
  \x1b[11m${'-a, --all'}\x1b[0m       \x1b[2m${'Hoard all repositories under user/org'}\x1b[0m
  \x1b[11m${'-s, --sources'}\x1b[0m   \x1b[2m${'Include source repositories owned by user/org (default)'}\x1b[0m
  \x1b[11m${'-m, --mirrors'}\x1b[0m   \x1b[2m${'Include mirror repositories'}\x1b[0m
  \x1b[11m${'-f, --forks'}\x1b[0m     \x1b[2m${'Include forked repositories'}\x1b[0m

  \x1b[11m${'-o, --one, --only'}\x1b[0m     \x1b[2m${'Clone only the specified repository'}\x1b[0m

\x1b[11m${'DEBUG:'}\x1b[0m
  \x1b[11m${'-V, --verbose'}\x1b[0m   \x1b[2m${'Verbosely log information to terminal'}\x1b[0m

\x1b[11m${'INFO:'}\x1b[0m
  \x1b[11m${'-h, --help'}\x1b[0m      \x1b[2m${'Display this help info'}\x1b[0m
  \x1b[11m${'-v, --version'}\x1b[0m   \x1b[2m${'Display version'}\x1b[0m
`

if (containsAny(args, ['-h', '--help'])) {
  console.info(HELP_INFO)
} else if (containsAny(args, ['-v', '--version'])) {
  console.info(VERSION_INFO)
} else {
  main()
    .then(function () {
      process.exit(0);
    })
    .catch(function (err) {
      console.error(err);
      process.exit(1);
    });
}