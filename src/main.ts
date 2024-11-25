import * as core from '@actions/core'
import * as slackapi from '@slack/web-api'
import * as types from '@slack/types'

type UpdateOpts = {
  channel: string
  ts: string
  blockId: string
  index: number
  status: string
}

async function updateBlocks(opts: UpdateOpts) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) {
    throw new Error('No `SLACK_BOT_TOKEN` environment set')
  }

  const slack = new slackapi.WebClient(token)
  const result = await slack.conversations.history({
    channel: opts.channel,
    latest: opts.ts,
    limit: 1,
    inclusive: true,
  })

  interface Field {
    text?: string
  }
  interface Block {
    block_id?: string
    fields?: Field[]
  }

  const blocks = result.messages![0].blocks!
  let block : undefined | Block = undefined
  for (const iter of blocks) {
    if (iter.block_id === opts.blockId) {
      block = iter
      break
    }
  }
  if (!block) {
    throw new Error(`Failed to find block_id '${opts.blockId}'`)
  }

  const fields = block.fields!
  if (!fields) {
    throw new Error(`Block '${opts.blockId}' does not contain fields`)
  }

  if (opts.index === -1) {
    // modify every-other field
    for (let index = 1; index < fields.length; index += 2) {
      fields[index].text = opts.status
    }
  } else {
    fields[opts.index*2 + 1].text = opts.status
  }

  await slack.chat.update({
    channel: opts.channel,
    ts: opts.ts,
    blocks: blocks as types.AnyBlock[]
  })
}

///
/// Entry point for the action
///
async function run() {
  const channel = core.getInput('channel')
  if (!channel) {
    throw new Error('No `channel` input supplied to the action')
  }

  const ts = core.getInput('ts')
  if (!ts) {
    throw new Error('No `ts` input supplied to the action')
  }

  const blockId = core.getInput('id')
  if (!blockId) {
    throw new Error('No `id` input supplied to the action')
  }

  const status = core.getInput('new-status')
  if (!status) {
    throw new Error('No `new-status` input supplied to the action')
  }

  const indexRaw = core.getInput('index')
  const index: number = indexRaw ? parseInt(indexRaw): -1

  await updateBlocks({
    channel: channel,
    ts: ts,
    blockId: blockId,
    index: index,
    status: status,
  })
}

run()
