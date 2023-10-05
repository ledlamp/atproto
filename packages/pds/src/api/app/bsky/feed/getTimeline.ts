import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { OutputSchema } from '../../../../lexicon/types/app/bsky/feed/getTimeline'
import { handleReadAfterWrite } from '../util/read-after-write'
import { LocalRecords } from '../../../../actor-store/local/reader'
import { ActorStoreReader } from '../../../../actor-store'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ params, auth }) => {
      const requester = auth.credentials.did
      const res = await ctx.appViewAgent.api.app.bsky.feed.getTimeline(
        params,
        await ctx.serviceAuthHeaders(requester),
      )
      return await handleReadAfterWrite(ctx, requester, res, getTimelineMunge)
    },
  })
}

const getTimelineMunge = async (
  store: ActorStoreReader,
  original: OutputSchema,
  local: LocalRecords,
): Promise<OutputSchema> => {
  const feed = await store.local.formatAndInsertPostsInFeed(
    [...original.feed],
    local.posts,
  )
  return {
    ...original,
    feed,
  }
}
