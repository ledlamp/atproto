import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthScope } from '../../../../auth'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getPreferences({
    auth: ctx.accessVerifier,
    handler: async ({ auth }) => {
      const requester = auth.credentials.did
      let preferences = await ctx.actorStore.read(requester, (store) => {
        return store.pref.getPreferences('app.bsky')
      })
      if (auth.credentials.scope !== AuthScope.Access) {
        // filter out personal details for app passwords
        preferences = preferences.filter(
          (pref) => pref.$type !== 'app.bsky.actor.defs#personalDetailsPref',
        )
      }
      return {
        encoding: 'application/json',
        body: { preferences },
      }
    },
  })
}
