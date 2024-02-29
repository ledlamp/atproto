import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.access,
    handler: async ({ req, params, auth }) => {
      const requester = auth.credentials.did
      return pipethrough(
        ctx,
        req,
        'app.bsky.graph.getFollows',
        params,
        requester,
      )
    },
  })
}
