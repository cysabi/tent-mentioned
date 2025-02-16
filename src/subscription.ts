import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
import { agent } from './agent'
import { AppBskyGraphGetFollows } from '@atproto/api'

const chara = 'did:plc:y562lo7bxujcar6fpjl6cyik'
const regexTentaBrella = new RegExp(`\\b${'tenta brella'}\\b`, 'i')
const regexTent = new RegExp(`\\b${'tent'}\\b`, 'i')

const getAllFollows = async (actor: string, cursor?: string) => {
  const resp = await agent.getFollows({ actor, cursor })
  if (resp.data.cursor) {
    return resp.data.follows.concat(
      await getAllFollows(actor, resp.data.cursor),
    )
  } else {
    return resp.data.follows
  }
}

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = (
      await Promise.all(
        ops.posts.creates.map(async (create) => {
          if (regexTentaBrella.test(create.record.text)) return create
          // check if author follows chara [todo: or follows anyone who follows prochara]
          if (regexTent.test(create.record.text)) {
            const follows = await getAllFollows(create.author)
            if (follows.find((follow) => follow.did === chara)) {
              return create
            }
          }
          return null
        }),
      )
    )
      .filter((create) => create !== null)
      .map((create) => {
        // map alf-related posts to a db row
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
        }
      })
    if (postsToCreate.length > 0) console.log(postsToCreate)

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
