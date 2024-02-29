import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethrough } from '../../../../pipethrough'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  const { bskyAppView } = ctx.cfg
  if (!bskyAppView) return
  server.app.bsky.unspecced.getTaggedSuggestions({
    auth: ctx.authVerifier.access,
    handler: async ({ req, auth, params }) => {
      const requester = auth.credentials.did
      return pipethrough(
        ctx,
        req,
        'app.bsky.unspecced.getTaggedSuggestions',
        params,
        requester,
      )
    },
  })
}
