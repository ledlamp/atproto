import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.feed.getActorFeeds({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      return pipethrough(
        ctx,
        req,
        'app.bsky.feed.getActorFeeds',
        params,
        requester,
      )
    },
  })
}
