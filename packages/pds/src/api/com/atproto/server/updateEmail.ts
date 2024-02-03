import disposable from 'disposable-email'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { UserAlreadyExistsError } from '../../../../services/account'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.server.updateEmail({
    auth: ctx.authVerifier.accessNotAppPassword,
    handler: async ({ auth, input }) => {
      const did = auth.credentials.did
      const { token, email } = input.body
      if (!disposable.validate(email)) {
        throw new InvalidRequestError(
          'This email address is not supported, please use a different email.',
        )
      }
      const user = await ctx.services.account(ctx.db).getAccount(did)
      if (!user) {
        throw new InvalidRequestError('user not found')
      }
      // require valid token if user email is confirmed
      if (user.emailConfirmedAt) {
        if (!token) {
          throw new InvalidRequestError(
            'confirmation token required',
            'TokenRequired',
          )
        }
        await ctx.services
          .account(ctx.db)
          .assertValidToken(did, 'update_email', token)
      }

      await ctx.db.transaction(async (dbTxn) => {
        const accntSrvce = ctx.services.account(dbTxn)

        await accntSrvce.deleteAllEmailTokens(did)

        if (user.email !== email) {
          try {
            await accntSrvce.updateEmail(did, email)
          } catch (err) {
            if (err instanceof UserAlreadyExistsError) {
              throw new InvalidRequestError(
                'This email address is already in use, please use a different email.',
              )
            } else {
              throw err
            }
          }
        }
      })
    },
  })
}
