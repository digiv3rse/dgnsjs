import { Address, Hex } from 'viem'
import {
  publicClient,
  testClient,
  waitForTransaction,
  walletClient,
} from '../../tests/addTestContracts'
import getOwner from '../fetch/getOwner'
import unwrapName from './unwrapName'

let snapshot: Hex
let accounts: Address[]

beforeAll(async () => {
  accounts = await walletClient.getAddresses()
})

beforeEach(async () => {
  snapshot = await testClient.snapshot()
})

afterEach(async () => {
  await testClient.revert({ id: snapshot })
})

it('should return a .eth unwrap name transaction and succeed', async () => {
  const tx = await unwrapName(walletClient, {
    name: 'wrapped.eth',
    newOwnerAddress: accounts[1],
    newRegistrantAddress: accounts[1],
    account: accounts[1],
  })
  expect(tx).toBeTruthy()
  const receipt = await waitForTransaction(tx)
  expect(receipt.status).toBe('success')

  const owner = await getOwner(publicClient, {
    name: 'wrapped.eth',
  })
  expect(owner!.owner).toBe(accounts[1])
  expect(owner!.registrant).toBe(accounts[1])
  expect(owner!.ownershipLevel).toBe('registrar')
})
it('should return a regular unwrap name transaction and succeed', async () => {
  const tx = await unwrapName(walletClient, {
    name: 'test.wrapped-with-subnames.eth',
    newOwnerAddress: accounts[1],
    account: accounts[2],
  })
  expect(tx).toBeTruthy()
  const receipt = await waitForTransaction(tx)
  expect(receipt.status).toBe('success')

  const owner = await getOwner(publicClient, {
    name: 'test.wrapped-with-subnames.eth',
  })
  expect(owner!.owner).toBe(accounts[1])
  expect(owner!.ownershipLevel).toBe('registry')
})
it('should error if newRegistrantAddress is not specified for .eth', async () => {
  await expect(
    unwrapName(walletClient, {
      name: 'wrapped.eth',
      newOwnerAddress: accounts[1],
      account: accounts[1],
    } as any),
  ).rejects.toThrow('Must provide newRegistrantAddress for 2ld .eth names')
})
it('should error if newRegistrantAddress is specified for non .eth', async () => {
  await expect(
    unwrapName(walletClient, {
      name: 'test.wrapped-with-subnames.eth',
      newOwnerAddress: accounts[1],
      newRegistrantAddress: accounts[1],
      account: accounts[2],
    } as any),
  ).rejects.toThrow(
    'newRegistrantAddress can only be specified for 2ld .eth names',
  )
})
