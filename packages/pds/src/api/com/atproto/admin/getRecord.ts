import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.com.atproto.admin.getRecord({
    auth: ctx.authVerifier.moderator,
    handler: async ({ req, params }) => {
      const { data: recordDetailAppview } =
        await moderationAgent.com.atproto.admin.getRecord(
          params,
          authPassthru(req),
        )
      return {
        encoding: 'application/json',
        body: recordDetailAppview,
      }
    },
  })
}
