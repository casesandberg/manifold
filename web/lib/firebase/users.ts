import { Contract } from 'common/contract'
import {
  isVerified,
  MINUTES_ALLOWED_TO_REFER,
  PrivateUser,
  User,
  UserAndPrivateUser,
} from 'common/user'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  GoogleAuthProvider,
  OAuthProvider,
  getAuth,
  signInWithPopup,
} from 'firebase/auth'
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore'
import { getIsNative } from 'web/lib/native/is-native'
import { nativeSignOut } from 'web/lib/native/native-messages'
import { safeLocalStorage } from '../util/local'
import { referUser } from './api'
import { app } from './init'
import { coll, getValues, listenForValue } from './utils'
import { removeUndefinedProps } from 'common/util/object'
import { postMessageToNative } from 'web/lib/native/post-message'

dayjs.extend(utc)

export const users = coll<User>('users')
export const privateUsers = coll<PrivateUser>('private-users')

export type { User }

export type Period = 'daily' | 'weekly' | 'monthly' | 'allTime'

export const auth = getAuth(app)

export async function getPrivateUser(userId: string) {
  /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
  return (await getDoc(doc(privateUsers, userId))).data()!
}

export async function getUserAndPrivateUser(userId: string) {
  const [user, privateUser] = (
    await Promise.all([
      getDoc(doc(users, userId))!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
      getDoc(doc(privateUsers, userId))!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
    ])
  ).map((d) => d.data()) as [User, PrivateUser]
  return { user, privateUser } as UserAndPrivateUser
}

export async function updateUser(userId: string, update: Partial<User>) {
  await updateDoc(doc(users, userId), { ...update })
}

export async function updatePrivateUser(
  userId: string,
  update: Partial<PrivateUser>
) {
  await updateDoc(doc(privateUsers, userId), { ...update })
}

export async function deletePrivateUser(userId: string) {
  await deleteDoc(doc(privateUsers, userId))
}

export function listenForUser(
  userId: string,
  setUser: (user: User | null) => void
) {
  const userRef = doc(users, userId)
  return listenForValue<User>(userRef, setUser)
}

export function listenForPrivateUser(
  userId: string,
  setPrivateUser: (privateUser: PrivateUser | null) => void
) {
  const userRef = doc(privateUsers, userId)
  return listenForValue<PrivateUser>(userRef, setPrivateUser)
}

export const CACHED_REFERRAL_USERNAME_KEY = 'CACHED_REFERRAL_KEY'
const CACHED_REFERRAL_CONTRACT_ID_KEY = 'CACHED_REFERRAL_CONTRACT_KEY'

// Scenarios:
// 1. User is referred by another user to homepage, group page, market page etc. explicitly via referrer= query param
// 2. User lands on a market or group without a referrer, we attribute the market/group creator
// Explicit referrers take priority over the implicit ones, (e.g. they're overwritten)
export function writeReferralInfo(
  defaultReferrerUsername: string,
  otherOptions?: {
    contractId?: string
    explicitReferrer?: string
  }
) {
  const local = safeLocalStorage
  const cachedReferralUser = local?.getItem(CACHED_REFERRAL_USERNAME_KEY)
  const { contractId, explicitReferrer } = otherOptions || {}

  // Write the first referral username we see.
  if (!cachedReferralUser) {
    local?.setItem(
      CACHED_REFERRAL_USERNAME_KEY,
      explicitReferrer || defaultReferrerUsername
    )
    if (contractId) local?.setItem(CACHED_REFERRAL_CONTRACT_ID_KEY, contractId)
  }

  // Overwrite all referral info if we see an explicit referrer.
  if (explicitReferrer) {
    local?.setItem(CACHED_REFERRAL_USERNAME_KEY, explicitReferrer)
    if (!contractId) local?.removeItem(CACHED_REFERRAL_CONTRACT_ID_KEY)
    else local?.setItem(CACHED_REFERRAL_CONTRACT_ID_KEY, contractId)
  }
}

export async function setCachedReferralInfoForUser(user: User) {
  if (!canSetReferrer(user)) return

  const local = safeLocalStorage
  const cachedReferralUsername = local?.getItem(CACHED_REFERRAL_USERNAME_KEY)
  const cachedReferralContractId = local?.getItem(
    CACHED_REFERRAL_CONTRACT_ID_KEY
  )
  const referralComplete = local?.getItem('referral-complete') == 'true'
  if (!cachedReferralUsername || referralComplete) return
  console.log(
    `User created in last ${MINUTES_ALLOWED_TO_REFER} minutes, trying to set referral`
  )
  // get user via username
  referUser(
    removeUndefinedProps({
      referredByUsername: cachedReferralUsername,
      contractId: cachedReferralContractId ?? undefined,
    })
  )
    .then((resp) => {
      console.log('referral resp', resp)
      local?.setItem('referral-complete', 'true')
    })
    .catch((err) => {
      console.log('error setting referral details', err)
    })
}

export async function firebaseLogin() {
  if (getIsNative()) {
    // Post the message back to expo
    postMessageToNative('loginClicked', {})
    return
  }
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider).then(async (result) => {
    return result
  })
}

export async function loginWithApple() {
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')

  return signInWithPopup(auth, provider)
    .then((result) => {
      return result
    })
    .catch((error) => {
      console.error(error)
    })
}

export async function firebaseLogout() {
  if (getIsNative()) nativeSignOut()

  await auth.signOut()
}

export function getUsers() {
  return getValues<User>(users)
}

export const isContractBlocked = (
  privateUser: PrivateUser | undefined | null,
  contract: Contract
) => {
  if (!privateUser) return false

  const {
    blockedContractIds,
    blockedByUserIds,
    blockedUserIds,
    blockedGroupSlugs,
  } = privateUser

  return (
    blockedContractIds?.includes(contract.id) ||
    contract.groupSlugs?.some((slug) => blockedGroupSlugs?.includes(slug)) ||
    blockedByUserIds?.includes(contract.creatorId) ||
    blockedUserIds?.includes(contract.creatorId)
  )
}

export const canSetReferrer = (user: User) => {
  if (user.referredByUserId) return false
  if (!isVerified(user)) return false
  const now = dayjs().utc()
  const userCreatedTime = dayjs(user.createdTime)
  return now.diff(userCreatedTime, 'minute') < MINUTES_ALLOWED_TO_REFER
}
