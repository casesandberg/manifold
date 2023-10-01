import { Col } from '../layout/col'
import { Group } from 'common/group'
import clsx from 'clsx'
import { Row } from 'web/components/layout/row'
import { PrivateUser, User } from 'common/user'
import { useRealtimeMemberGroups } from 'web/hooks/use-group-supabase'
import { Button } from 'web/components/buttons/button'
import { MdOutlineKeyboardDoubleArrowRight } from 'react-icons/md'
import { track } from 'web/lib/service/analytics'
import { TopicOptionsButton } from 'web/components/topics/topics-button'
import { ForYouDropdown } from 'web/components/topics/for-you-dropdown'
import {
  SIDE_BAR_ITEM_HOVER_CLASS,
  SIDEBAR_SELECTED_ITEM_CLASS,
  SIDEBAR_UNSELECTED_ITEM_CLASS,
} from 'web/components/nav/sidebar-item'
import { ReactNode } from 'react'

const ROW_CLASS =
  'group relative w-full cursor-pointer items-center rounded-md py-4 px-2'
export function TopicsList(props: {
  topics: Group[]
  loadMore?: () => Promise<boolean>
  currentTopicSlug?: string
  setCurrentTopicSlug: (slug: string) => void
  privateUser: PrivateUser | null | undefined
  user: User | null | undefined
  show: boolean
  setShow: (show: boolean) => void
  className?: string
}) {
  const {
    currentTopicSlug,
    privateUser,
    user,
    setCurrentTopicSlug,
    show,
    setShow,
    className,
  } = props
  const topics = props.topics.filter(
    (g) => !privateUser?.blockedGroupSlugs.includes(g.slug)
  )
  const yourGroups = useRealtimeMemberGroups(user?.id)
  const widthClasses =
    'xl:min-w-64 min-w-[7rem] sm:min-w-[8rem] md:min-w-[10.5rem]'
  return (
    <Col
      className={clsx(
        show
          ? 'animate-slide-in-from-right block xl:animate-none'
          : 'hidden xl:flex',
        className,
        'scrollbar-hide sticky top-0 right-10 max-h-screen overflow-y-auto sm:max-w-min xl:max-w-none',
        currentTopicSlug == 'for-you' ? '' : 'xl:rounded-t-md '
      )}
    >
      <div
        className={
          'bg-canvas-50 sticky top-0 z-10 w-full items-center justify-center'
        }
      >
        <div className="text-primary-700 hidden w-full pb-2 pl-2 xl:block">
          Topics
        </div>
        <Button
          className={clsx('h-[3.15rem] xl:hidden', widthClasses)}
          color={'gray-white'}
          size={'md'}
          onClick={() => setShow(!show)}
        >
          <MdOutlineKeyboardDoubleArrowRight className="mr-1 h-5 w-5" />
          Topics
        </Button>
      </div>
      {user && (
        <SidebarItem
          key={'all-questions'}
          slug={''}
          name={'🌎 All questions'}
          currentTopicSlug={currentTopicSlug}
          setCurrentTopicSlug={setCurrentTopicSlug}
          optionsItem={<></>}
        />
      )}
      {user && (
        <SidebarItem
          key={'sidebar-for-you'}
          slug={'for-you'}
          name={'⭐️ For you'}
          currentTopicSlug={currentTopicSlug}
          setCurrentTopicSlug={setCurrentTopicSlug}
          optionsItem={
            <ForYouDropdown
              setCurrentCategory={setCurrentTopicSlug}
              user={user}
              yourGroups={yourGroups}
              className={clsx(
                'mr-1',
                currentTopicSlug !== 'for-you'
                  ? 'opacity-0 group-hover:opacity-100'
                  : 'opacity-100'
              )}
            />
          }
        />
      )}
      {topics.length > 0 &&
        topics.map((group) => (
          <SidebarItem
            key={group.id}
            slug={group.slug}
            name={group.name}
            currentTopicSlug={currentTopicSlug}
            setCurrentTopicSlug={setCurrentTopicSlug}
            optionsItem={
              <TopicOptionsButton
                key={group.id}
                group={group}
                yourGroupIds={yourGroups?.map((g) => g.id)}
                user={user}
                className={'mr-1'}
                selected={currentTopicSlug == group.slug}
              />
            }
          />
        ))}
    </Col>
  )
}
const SidebarItem = (props: {
  slug: string
  name: string
  currentTopicSlug: string | undefined
  setCurrentTopicSlug: (slug: string) => void
  optionsItem: ReactNode
}) => {
  const { slug, name, currentTopicSlug, setCurrentTopicSlug, optionsItem } =
    props

  return (
    <Row
      className={clsx(
        ROW_CLASS,
        SIDE_BAR_ITEM_HOVER_CLASS,
        currentTopicSlug == slug
          ? SIDEBAR_SELECTED_ITEM_CLASS
          : SIDEBAR_UNSELECTED_ITEM_CLASS
      )}
      onClick={() => {
        if (currentTopicSlug !== slug) track('select topics item', { slug })
        setCurrentTopicSlug(currentTopicSlug === slug ? '' : slug)
      }}
    >
      <span
        className={clsx(
          ' flex w-full flex-row text-left text-sm',
          currentTopicSlug == slug ? 'font-semibold' : ''
        )}
      >
        {name}
      </span>
      {optionsItem}
    </Row>
  )
}