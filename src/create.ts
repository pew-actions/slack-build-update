import * as core from '@actions/core'
import * as fs from 'fs'
import {v4 as uuid} from 'uuid'
import * as gitSource from './git-source'

async function run() {

  const gitToken = core.getInput('git-token')
  if (!gitToken) {
    throw new Error('No `git-token` input supplied to the action')
  }

  const blocksRaw = core.getInput('blocks')
  if (!blocksRaw) {
    throw new Error('No `blocks` input supplied to the action')
  }

  const repository = core.getInput('repository')
  if (!repository) {
    throw new Error('No `repository` input supplied to the action')
  }

  const blocks = JSON.parse(blocksRaw)

  try {
    const git = await gitSource.getSource({
      repository: repository,
      token: gitToken,
      path: '.blocks',
      ref: 'main',
    })

    // create a new branch for this run
    const branchName = uuid()
    if (await git.branchExists(true, branchName)) {
      throw new Error(`Git remote branch '${branchName}' already exists`)
    }
    if (await git.branchExists(false, branchName)) {
      throw new Error(`Git branch '${branchName}' already exists`)
    }

    await git.execGit(['checkout', '-b', branchName], false, false, {})
    console.log(`Git branch name: '${branchName}'`)
    core.setOutput('branch-name', branchName)

    // set our blocks.json content
    fs.writeFileSync('.blocks/blocks.json', JSON.stringify(blocks, null, 2))

    // commit and push the change
    await git.execGit(['add', '-u', 'blocks.json'], false, false, {})
    await git.execGit(['commit', '-m', 'Initial block configuration'], false, false, {})
    await git.execGit(['push', 'origin', `${branchName}`], false, false, {})

  } finally {
    // remove the local repository
    await fs.rmSync('.blocks', {recursive: true, force: true})
  }
}

run()
