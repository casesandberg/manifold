import { memo, useState } from 'react'
import dayjs from 'dayjs'
import { Contract } from 'common/contract'
import { Bet } from 'common/bet'
import { useUser } from 'web/hooks/use-user'
import { Row } from 'web/components/layout/row'
import {
  Avatar,
  AvatarSizeType,
  EmptyAvatar,
} from 'web/components/widgets/avatar'
import clsx from 'clsx'
import { formatMoney } from 'common/util/format'
import { OutcomeLabel } from 'web/components/outcome-label'
import { RelativeTimestamp } from 'web/components/relative-timestamp'
import { getFormattedMappedValue } from 'common/pseudo-numeric'
import { UserLink } from 'web/components/widgets/user-link'
import { BETTOR } from 'common/user'
import { floatingEqual, floatingLesserEqual } from 'common/util/math'
import { Col } from 'web/components/layout/col'
import { ReplyIcon } from '@heroicons/react/solid'
import { track } from 'web/lib/service/analytics'
import { Tooltip } from 'web/components/widgets/tooltip'
import { InfoTooltip } from '../widgets/info-tooltip'
import { filterDefined } from 'common/util/array'
import { sumBy, uniq } from 'lodash'
import { Modal, MODAL_CLASS } from 'web/components/layout/modal'
import { MultipleOrSingleAvatars } from 'web/components/multiple-or-single-avatars'
import { RepostButton } from 'web/components/comments/repost-modal'
import { Button } from 'web/components/buttons/button'
import { UserHovercard } from '../user/user-hovercard'

export const FeedBet = memo(function FeedBet(props: {
  contract: Contract
  bet: Bet
  avatarSize?: AvatarSizeType
  className?: string
  onReply?: (bet: Bet) => void
}) {
  const { contract, bet, avatarSize, className, onReply } = props
  const { userAvatarUrl, userUsername, createdTime, userId } = bet
  const showUser = dayjs(createdTime).isAfter('2022-06-01')

  return (
    <Col className={'w-full'}>
      <Row className={'justify-between'}>
        <Row className={clsx(className, 'items-center gap-2')}>
          {showUser ? (
            <UserHovercard userId={userId}>
              <Avatar
                size={avatarSize}
                avatarUrl={userAvatarUrl}
                username={userUsername}
              />
            </UserHovercard>
          ) : (
            <EmptyAvatar className="mx-1" />
          )}
          <BetStatusText
            bet={bet}
            contract={contract}
            hideUser={!showUser}
            className="flex-1"
          />
        </Row>
        <BetActions onReply={onReply} bet={bet} contract={contract} />
      </Row>
    </Col>
  )
})
export const FeedReplyBet = memo(function FeedReplyBet(props: {
  contract: Contract
  bets: Bet[]
  avatarSize?: AvatarSizeType
  className?: string
  onReply?: (bet: Bet) => void
}) {
  const { contract, bets, avatarSize, className } = props
  const showUser = bets.every((b) => dayjs(b.createdTime).isAfter('2022-06-01'))
  const avatars = filterDefined(
    uniq(bets.map((b) => ({ avatarUrl: b.userAvatarUrl ?? '', id: b.userId })))
  )
  const [showBets, setShowBets] = useState(false)
  return (
    <Col className={'w-full'}>
      <Row className={'w-full gap-2'}>
        {!showUser || avatars.length === 0 ? (
          <EmptyAvatar className="mx-1" />
        ) : avatars.length === 1 ? (
          <UserHovercard userId={bets[0].userId}>
            <Avatar
              size={avatarSize}
              avatarUrl={bets[0].userAvatarUrl}
              username={bets[0].userUsername}
            />
          </UserHovercard>
        ) : (
          avatars.length > 1 && (
            <MultipleOrSingleAvatars
              size={'2xs'}
              spacing={-0.2}
              startLeft={0.2}
              onClick={() => setShowBets(true)}
              avatars={avatars}
            />
          )
        )}
        {showBets && (
          <Modal open={showBets} setOpen={setShowBets}>
            <Col className={MODAL_CLASS}>
              {bets.map((bet) => (
                <FeedBet
                  key={bet.id + 'modal-bet'}
                  contract={contract}
                  bet={bet}
                />
              ))}
            </Col>
          </Modal>
        )}
        <Row
          className={clsx(
            className,
            'w-full items-start gap-2 rounded-r-lg rounded-bl-lg  p-1'
          )}
        >
          {bets.length === 1 ? (
            <BetStatusText
              bet={bets[0]}
              contract={contract}
              hideUser={!showUser}
              className="flex-1"
            />
          ) : (
            <BetStatusesText bets={bets} contract={contract} />
          )}
        </Row>
      </Row>
    </Col>
  )
})

export function BetStatusesText(props: {
  contract: Contract
  bets: Bet[]
  className?: string
  inTimeline?: boolean
}) {
  const { bets, contract, className, inTimeline } = props
  const {
    amount,
    outcome,
    createdTime,
    answerId,
    userId,
    userName,
    userUsername,
  } = bets[0]

  const bought = amount >= 0 ? 'bought' : 'sold'
  const absAmount = Math.abs(sumBy(bets, (b) => b.amount))
  const money = formatMoney(absAmount)
  const uniqueUsers = uniq(bets.map((b) => b.userId))

  return (
    <div className={clsx('text-ink-1000 text-sm', className)}>
      {!inTimeline &&
        (uniqueUsers.length === 1 ? (
          <UserHovercard userId={userId}>
            <UserLink
              user={{ id: userId, name: userName, username: userUsername }}
              className={'font-semibold'}
            />
          </UserHovercard>
        ) : (
          <span>{`${uniq(bets.map((b) => b.userId)).length} traders`}</span>
        ))}{' '}
      <>
        {bought} {money}{' '}
        <OutcomeLabel
          outcome={outcome}
          answerId={answerId}
          contract={contract}
          truncate="short"
        />{' '}
      </>
      {!inTimeline && <RelativeTimestamp time={createdTime} shortened={true} />}
    </div>
  )
}

export function BetStatusText(props: {
  contract: Contract
  bet: Bet
  hideUser?: boolean
  className?: string
  inTimeline?: boolean
}) {
  const { bet, contract, hideUser, className, inTimeline } = props
  const self = useUser()
  const { amount, outcome, createdTime, answerId, isApi } = bet

  const bought = amount >= 0 ? 'bought' : 'sold'
  const absAmount = Math.abs(amount)
  const money = formatMoney(absAmount)
  const orderAmount =
    bet.limitProb !== undefined && bet.orderAmount !== undefined
      ? formatMoney(bet.orderAmount)
      : ''
  const anyFilled = !floatingLesserEqual(amount, 0)
  const allFilled = floatingEqual(amount, bet.orderAmount ?? amount)

  const hadPoolMatch =
    (bet.limitProb === undefined ||
      bet.fills?.some((fill) => fill.matchedBetId === null)) ??
    false

  const fromProb = hadPoolMatch
    ? getFormattedMappedValue(contract, bet.probBefore)
    : getFormattedMappedValue(contract, bet.limitProb ?? bet.probBefore)

  const toProb = hadPoolMatch
    ? getFormattedMappedValue(contract, bet.probAfter)
    : getFormattedMappedValue(contract, bet.limitProb ?? bet.probAfter)

  return (
    <div className={clsx('text-ink-1000 text-sm', className)}>
      {!inTimeline ? (
        !hideUser ? (
          <UserHovercard userId={bet.userId}>
            <UserLink
              user={{
                id: bet.userId,
                name: bet.userName,
                username: bet.userUsername,
              }}
              className={'font-semibold'}
            />
          </UserHovercard>
        ) : (
          <span>{self?.id === bet.userId ? 'You' : `A ${BETTOR}`}</span>
        )
      ) : (
        <></>
      )}{' '}
      {orderAmount ? (
        <span>
          {anyFilled ? (
            <>
              filled limit order {money}/{orderAmount}
            </>
          ) : (
            <>created limit order for {orderAmount}</>
          )}{' '}
          <OutcomeLabel
            outcome={outcome}
            answerId={answerId}
            contract={contract}
            truncate="short"
          />{' '}
          at {toProb} {bet.isCancelled && !allFilled ? '(cancelled)' : ''}
        </span>
      ) : (
        <>
          {bought} {money}{' '}
          <OutcomeLabel
            outcome={outcome}
            answerId={answerId}
            contract={contract}
            truncate="short"
          />{' '}
          {fromProb === toProb
            ? `at ${fromProb}`
            : `from ${fromProb} to ${toProb}`}
        </>
      )}{' '}
      {isApi && <InfoTooltip text="Placed via the API">🤖</InfoTooltip>}
      {!inTimeline && <RelativeTimestamp time={createdTime} shortened={true} />}
    </div>
  )
}

function BetActions(props: {
  onReply?: (bet: Bet) => void
  bet: Bet
  contract: Contract
}) {
  const { onReply, bet, contract } = props
  const user = useUser()
  if (!user) return null
  return (
    <Row className="items-center gap-1">
      <RepostButton
        bet={bet}
        size={'2xs'}
        className={'!p-1'}
        contract={contract}
      />
      {onReply && (
        <Tooltip
          text={` Reply to ${bet.userName}'s bet`}
          placement="top"
          className="mr-2"
        >
          <Button
            className={'!p-1'}
            color={'gray-white'}
            size={'2xs'}
            onClick={() => {
              onReply(bet)
              track('reply to bet', {
                slug: contract.slug,
                amount: bet.amount,
              })
            }}
          >
            <ReplyIcon className=" h-5 w-5" />
          </Button>
        </Tooltip>
      )}
    </Row>
  )
}
