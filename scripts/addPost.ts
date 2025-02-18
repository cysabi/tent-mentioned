import dotenv from 'dotenv'
import { createDb, Database } from '../src/db'
import { agent } from '../src/agent'
import inquirer from 'inquirer'
import { Post } from '../src/db/schema'
import AtpAgent from '@atproto/api'

const run = async () => {
  dotenv.config()
  await agent.login({
    identifier: 'cysabi.github.io',
    password: process.env.AGENT_PASSWORD!,
  })
  const db = createDb(process.env.FEEDGEN_SQLITE_LOCATION || 'db/db.sqlite')

  const post = await askPost(agent)
  console.log(post)
  await insertPost(db, post)
}

const askPost = async (agent: AtpAgent) => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'link',
      message: 'Enter post link:',
      required: true,
    },
  ])
  const [handle, rkey] = answers.link
    .replace('https://bsky.app/profile/', '')
    .split('/post/')
  const record = await agent.com.atproto.repo.getRecord({
    repo: handle,
    collection: 'app.bsky.feed.post',
    rkey: rkey,
  })

  return {
    uri: record.data.cid as string,
    cid: record.data.uri as string,
    indexedAt: (record.data.value as any).createdAt as string,
  }
}

const insertPost = async (db: Database, post: Post) => {
  db.insertInto('post')
    .values([post])
    .onConflict((oc) => oc.doNothing())
    .execute()
}

run()
