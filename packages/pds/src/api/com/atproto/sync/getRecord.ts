import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { byteIterableToStream } from '@atproto/common'
import { isUserOrAdmin } from '../../../../auth'
import { SqlRepoReader } from '../../../../actor-store/repo/sql-repo-reader'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRecord({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, auth }) => {
      const { did, collection, rkey } = params
      // takedown check for anyone other than an admin or the user
      if (!isUserOrAdmin(auth, did)) {
        const available = await ctx.services
          .account(ctx.db)
          .isRepoAvailable(did)
        if (!available) {
          throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
        }
      }
      // must open up the db outside of store interface so that we can close the file handle after finished streaming
      const actorDb = await ctx.actorStore.db(did)
      const storage = new SqlRepoReader(actorDb)
      const commit = params.commit
        ? CID.parse(params.commit)
        : await storage.getRoot()

      if (!commit) {
        throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
      }
      const carIter = repo.getRecords(storage, commit, [{ collection, rkey }])
      const carStream = byteIterableToStream(carIter)
      carStream.on('close', actorDb.close)
      return {
        encoding: 'application/vnd.ipld.car',
        body: carStream,
      }
    },
  })
}
