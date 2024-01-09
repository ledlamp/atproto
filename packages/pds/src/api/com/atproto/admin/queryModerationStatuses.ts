import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationStatuses({
    auth: ctx.authVerifier.role,
    handler: async ({ req, params }) => {
      const { data } =
        await ctx.moderationAgent.com.atproto.admin.queryModerationStatuses(
          params,
          authPassthru(req),
        )
      return {
        encoding: 'application/json',
        body: data,
      }
    },
  })
}
