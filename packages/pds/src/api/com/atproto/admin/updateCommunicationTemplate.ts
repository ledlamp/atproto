import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { authPassthru } from '../../../proxy'

export default function (server: Server, ctx: AppContext) {
  const { moderationAgent } = ctx
  if (!moderationAgent) return
  server.com.atproto.admin.updateCommunicationTemplate({
    auth: ctx.authVerifier.access,
    handler: async ({ req, input }) => {
      const { data: result } =
        await moderationAgent.com.atproto.admin.updateCommunicationTemplate(
          input.body,
          authPassthru(req, true),
        )

      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}
