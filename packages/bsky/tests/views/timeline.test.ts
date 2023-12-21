import assert from 'assert'
import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import { forSnapshot, getOriginator, paginateAll } from '../_util'
import basicSeed from '../seeds/basic'
import { FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'
import { PrimaryDatabase } from '../../src'

const REVERSE_CHRON = 'reverse-chronological'

describe('timeline views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_home_feed',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    // Label posts as "kind" to check labels on embed views
    const labelPostA = sc.posts[bob][0].ref
    const labelPostB = sc.posts[carol][0].ref
    await createLabel(network.bsky.db.getPrimary(), {
      val: 'kind',
      uri: labelPostA.uriStr,
      cid: labelPostA.cidStr,
    })
    await createLabel(network.bsky.db.getPrimary(), {
      val: 'kind',
      uri: labelPostB.uriStr,
      cid: labelPostB.cidStr,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  // @TODO(bsky) blocks posts, reposts, replies by actor takedown via labels
  // @TODO(bsky) blocks posts, reposts, replies by record takedown via labels

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy = (did) => (item: FeedViewPost) => {
      const originator = getOriginator(item)
      // The user expects to see posts & reposts from themselves and follows
      if (did !== originator) {
        expect(sc.follows[did]).toHaveProperty(originator)
      }
    }

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(alice),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(bob),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(carol),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(dan),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: await network.serviceHeaders(alice),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      {
        headers: await network.serviceHeaders(alice),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: REVERSE_CHRON,
          cursor,
          limit: 4,
        },
        { headers: await network.serviceHeaders(carol) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(4),
    )

    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: REVERSE_CHRON,
      },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('reflects self-labels', async () => {
    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: await network.serviceHeaders(carol) },
    )

    const alicePost = carolTL.data.feed.find(
      ({ post }) => post.uri === sc.posts[alice][0].ref.uriStr,
    )?.post

    assert(alicePost, 'post does not exist')

    const postSelfLabels = alicePost.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)

    expect(postSelfLabels).toEqual(['self-label'])

    const authorSelfLabels = alicePost.author.labels
      ?.filter((label) => label.src === alice)
      .map((label) => label.val)
      .sort()

    expect(authorSelfLabels).toEqual(['self-label-a', 'self-label-b'])
  })

  it('blocks posts, reposts, replies by actor takedown', async () => {
    await Promise.all(
      [bob, carol].map((did) =>
        network.bsky.ctx.dataplane.updateTakedown({
          actorDid: did,
          takenDown: true,
        }),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      [bob, carol].map((did) =>
        network.bsky.ctx.dataplane.updateTakedown({
          actorDid: did,
          takenDown: false,
        }),
      ),
    )
  })

  it('blocks posts, reposts, replies by record takedown.', async () => {
    const postRef1 = sc.posts[dan][1].ref // Repost
    const postRef2 = sc.replies[bob][0].ref // Post and reply parent
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.updateTakedown({
          recordUri: postRef.uriStr,
          takenDown: true,
        }),
      ),
    )

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: REVERSE_CHRON },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()

    // Cleanup
    await Promise.all(
      [postRef1, postRef2].map((postRef) =>
        network.bsky.ctx.dataplane.updateTakedown({
          recordUri: postRef.uriStr,
          takenDown: false,
        }),
      ),
    )
  })
})

const createLabel = async (
  db: PrimaryDatabase,
  opts: { uri: string; cid: string; val: string },
) => {
  await db.db
    .insertInto('label')
    .values({
      uri: opts.uri,
      cid: opts.cid,
      val: opts.val,
      cts: new Date().toISOString(),
      neg: false,
      src: 'did:example:labeler',
    })
    .execute()
}
