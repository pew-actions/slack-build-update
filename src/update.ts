import * as core from '@actions/core'
import * as fs from 'fs'
import * as gitSource from './git-source'
import * as slackapi from '@slack/web-api'
import * as types from '@slack/types'

type UpdateOpts = {
  blockId: string
  blockIndex: number
  status: string
}

interface Field {
  text?: string
}

interface Block {
  block_id?: string
  fields?: Field[]
}

function updateBlocks(blocks: Block[], opts: UpdateOpts) {

  // find our block
  let block : undefined | Block = undefined
  for (const iter of blocks) {
    if (iter.block_id === opts.blockId) {
      block = iter
    }
  }
  if (!block) {
    throw new Error(`Failed to find block with id '${opts.blockId}'`)
  }

  const fields = block.fields!
  if (!fields) {
    throw new Error(`Block '${opts.blockId}' does not contain fields`)
  }

  if (opts.blockIndex === -1) {
    // mofify every other field
    for (let index = 1; index < fields.length; index += 2) {
      fields[index].text = opts.status
    }
  } else {
    fields[opts.blockIndex*2 + 1].text = opts.status
  }
}

async function run() {

  const gitToken = core.getInput('git-token')
  if (!gitToken) {
    throw new Error('No `git-token` input supplied to the action')
  }

  const slackToken = process.env.SLACK_BOT_TOKEN
  if (!slackToken) {
    throw new Error('No `SLACK_BOT_TOKEN` environment set')
  }

  const channelId = core.getInput('channel-id')
  if (!channelId) {
    throw new Error('No `channel-id` input supplied to the action')
  }

  const ts = core.getInput('ts')
  if (!ts) {
    throw new Error('No `ts` input supplied to the action')
  }

  const repository = core.getInput('repository')
  if (!repository) {
    throw new Error('No `repository` input supplied to the action')
  }

  const branch = core.getInput('branch')
  if (!branch) {
    throw new Error('No `branch` input supplied to the action')
  }

  const blockId = core.getInput('block-id')
  if (!blockId) {
    throw new Error('No `block-id` input supplied to the action')
  }

  const indexRaw = core.getInput('block-index') || '-1'
  const blockIndex = parseInt(indexRaw)

  const status = core.getInput('status')
  if (!status) {
    throw new Error('No `status` input supplied to the action')
  }

  const maxRetries = parseInt(core.getInput('max-retries'))

  const slack = new slackapi.WebClient(slackToken)

  try {
    const git = await gitSource.getSource({
      repository: repository,
      token: gitToken,
      path: '.blocks',
      ref: branch,
    })

    const refSpec = ['+refs/heads/*:refs/remotes/origin/*']

    // comare-update loop
    let retriesRemaining = maxRetries
    for (;;) {

      await git.fetch(refSpec, {})
      await git.execGit(['reset', '--hard', `origin/${branch}`], false, false, {})
      const baseCommit = await git.execGit(['log', '-1', '--format=%H', `origin/${branch}`], false, false, {})

      // load blocks
      const blocks = JSON.parse(fs.readFileSync('.blocks/blocks.json').toString())

      // modify blocks
      updateBlocks(blocks, {
        blockId: blockId,
        blockIndex: blockIndex,
        status: status,
      })

      // write block changes
      fs.writeFileSync('.blocks/blocks.json', JSON.stringify(blocks, null, 2))

      // commit changes
      await git.execGit(['add', '-u', 'blocks.json'], false, false, {})
      await git.execGit(['commit', '-m', 'Update message queue'], false, false, {})

      // early check for conflicts
      const currentCommit = await git.execGit(['log', '-1', '--format=%H', `origin/${branch}`], false, false, {})
      if (currentCommit.stdout !== baseCommit.stdout) {
        console.log(`Detected early conflict ${currentCommit.stdout} != ${baseCommit.stdout}. Retrying...`)
        continue
      }

      // update slack
      await slack.chat.update({
        channel: channelId,
        ts: ts,
        blocks: blocks as types.AnyBlock[]
      })

      // attempt to push changes
      try {
        await git.execGit(['push', 'origin', branch], false, false, {})
        return
      } catch {

        --retriesRemaining
        if (retriesRemaining <= 0) {
          throw new Error('Failed to resolve message queue conflicts')
        }

        console.log('Conflict in slack message queue detected. Retrying...')
      }
    }

  } finally {
    // remove the local repository
    await fs.rmSync('.blocks', {recursive: true, force: true})
  }
}

run()
