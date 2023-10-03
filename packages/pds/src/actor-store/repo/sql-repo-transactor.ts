import { CommitData, RepoStorage, BlockMap } from '@atproto/repo'
import { chunkArray } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ActorDb, IpldBlock } from '../actor-db'
import { SqlRepoReader } from './sql-repo-reader'

export class SqlRepoTransactor extends SqlRepoReader implements RepoStorage {
  cache: BlockMap = new BlockMap()
  now: string

  constructor(public db: ActorDb, now?: string) {
    super(db)
    this.now = now ?? new Date().toISOString()
  }

  // proactively cache all blocks from a particular commit (to prevent multiple roundtrips)
  async cacheRev(rev: string): Promise<void> {
    const res = await this.db.db
      .selectFrom('ipld_block')
      .where('repoRev', '=', rev)
      .select(['ipld_block.cid', 'ipld_block.content'])
      .limit(15)
      .execute()
    for (const row of res) {
      this.cache.set(CID.parse(row.cid), row.content)
    }
  }

  async putBlock(cid: CID, block: Uint8Array, rev: string): Promise<void> {
    this.db.assertTransaction()
    await this.db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        repoRev: rev,
        size: block.length,
        content: block,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    this.cache.set(cid, block)
  }

  async putMany(toPut: BlockMap, rev: string): Promise<void> {
    this.db.assertTransaction()
    const blocks: IpldBlock[] = []
    toPut.forEach((bytes, cid) => {
      blocks.push({
        cid: cid.toString(),
        repoRev: rev,
        size: bytes.length,
        content: bytes,
      })
      this.cache.addMap(toPut)
    })
    await Promise.all(
      chunkArray(blocks, 500).map((batch) =>
        this.db.db
          .insertInto('ipld_block')
          .values(batch)
          .onConflict((oc) => oc.doNothing())
          .execute(),
      ),
    )
  }

  async deleteMany(cids: CID[]) {
    if (cids.length < 1) return
    const cidStrs = cids.map((c) => c.toString())
    await this.db.db
      .deleteFrom('ipld_block')
      .where('cid', 'in', cidStrs)
      .execute()
  }

  async applyCommit(commit: CommitData) {
    await Promise.all([
      this.updateRoot(commit.cid, commit.rev),
      this.putMany(commit.newBlocks, commit.rev),
      this.deleteMany(commit.removedCids.toList()),
    ])
  }

  async updateRoot(cid: CID, rev: string): Promise<void> {
    await this.db.db
      .insertInto('repo_root')
      .values({
        cid: cid.toString(),
        rev: rev,
        indexedAt: this.now,
      })
      .execute()
  }

  async destroy(): Promise<void> {
    throw new Error('Destruction of SQL repo storage not allowed at runtime')
  }
}
