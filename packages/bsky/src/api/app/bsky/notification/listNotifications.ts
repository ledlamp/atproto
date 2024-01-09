import { InvalidRequestError } from '@atproto/xrpc-server'
import { mapDefined } from '@atproto/common'
import { Server } from '../../../../lexicon'
import { QueryParams } from '../../../../lexicon/types/app/bsky/notification/listNotifications'
import AppContext from '../../../../context'
import {
  createPipeline,
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { Notification } from '../../../../data-plane/gen/bsky_pb'
import { didFromUri } from '../../../../hydration/util'

export default function (server: Server, ctx: AppContext) {
  const listNotifications = createPipeline(
    skeleton,
    hydration,
    noBlockOrMutes,
    presentation,
  )
  server.app.bsky.notification.listNotifications({
    auth: ctx.authVerifier.standard,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.iss
      const result = await listNotifications({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: result,
      }
    },
  })
}

const skeleton = async (
  input: SkeletonFnInput<Context, Params>,
): Promise<SkeletonState> => {
  const { params, ctx } = input
  if (params.seenAt) {
    throw new InvalidRequestError('The seenAt parameter is unsupported')
  }
  const [res, lastSeenRes] = await Promise.all([
    ctx.hydrator.dataplane.getNotifications({
      actorDid: params.viewer,
      cursor: params.cursor,
      limit: params.limit,
    }),
    ctx.hydrator.dataplane.getNotificationSeen({
      actorDid: params.viewer,
    }),
  ])
  return {
    notifs: res.notifications,
    cursor: res.cursor || undefined,
    lastSeenNotifs: lastSeenRes.timestamp?.toDate().toISOString(),
  }
}

const hydration = async (
  input: HydrationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, params, ctx } = input
  return ctx.hydrator.hydrateNotifications(skeleton.notifs, params.viewer)
}

const noBlockOrMutes = (
  input: RulesFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, ctx } = input
  skeleton.notifs = skeleton.notifs.filter((item) => {
    const did = didFromUri(item.uri)
    return (
      !ctx.views.viewerBlockExists(did, hydration) &&
      !ctx.views.viewerMuteExists(did, hydration)
    )
  })
  return skeleton
}

const presentation = (
  input: PresentationFnInput<Context, Params, SkeletonState>,
) => {
  const { skeleton, hydration, ctx } = input
  const { notifs, lastSeenNotifs, cursor } = skeleton
  const notifications = mapDefined(notifs, (notif) =>
    ctx.views.notification(notif, lastSeenNotifs, hydration),
  )
  return { notifications, cursor, seenAt: skeleton.lastSeenNotifs }
}

type Context = {
  hydrator: Hydrator
  views: Views
}

type Params = QueryParams & {
  viewer: string
}

type SkeletonState = {
  notifs: Notification[]
  lastSeenNotifs?: string
  cursor?: string
}
