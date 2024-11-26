import * as core from '@actions/core'
import * as fs from 'fs'
import * as gitSource from './git-source'

async function run() {
  const gitToken = core.getInput('git-token')
  if (!gitToken) {
    throw new Error('No `git-token` input supplied to the action')
  }

  const repository = core.getInput('repository')
  if (!repository) {
    throw new Error('No `repository` input supplied to the action')
  }

  const branch = core.getInput('branch')
  if (!branch) {
    throw new Error('No `branch` input supplied to the action')
  }

  try {
    const git = await gitSource.getSource({
      repository: repository,
      token: gitToken,
      path: '.blocks',
      ref: branch,
    })

    await git.execGit(['push', 'origin', `:${branch}`], false, false, {})

  } finally {
    // remove the local repository
    await fs.rmSync('.blocks', {recursive: true, force: true})
  }
}

run()
