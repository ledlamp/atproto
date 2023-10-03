import { CID } from 'multiformats/cid'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { BlobNotFoundError } from '@atproto/repo'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getBlob({
    auth: ctx.optionalAccessOrRoleVerifier,
    handler: async ({ params, res }) => {
      // @TODO verify repo is not taken down
      const cid = CID.parse(params.cid)
      let found
      try {
        found = await ctx.actorStore.reader(params.did).repo.blob.getBlob(cid)
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          throw new InvalidRequestError('Blob not found')
        } else {
          throw err
        }
      }
      if (!found) {
        throw new InvalidRequestError('Blob not found')
      }
      res.setHeader('content-length', found.size)
      res.setHeader('x-content-type-options', 'nosniff')
      res.setHeader('content-security-policy', `default-src 'none'; sandbox`)
      return {
        // @TODO better codegen for */* mimetype
        encoding: (found.mimeType || 'application/octet-stream') as '*/*',
        body: found.stream,
      }
    },
  })
}
