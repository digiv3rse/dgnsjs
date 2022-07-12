import { Signer } from 'ethers'
import { ENSArgs } from '..'
import { namehash } from '../utils/normalise'

export default async function (
  { contracts, provider }: ENSArgs<'contracts' | 'provider'>,
  name: string,
  contract: 'registry' | 'nameWrapper',
  resolver?: string,
  options?: { addressOrIndex?: string | number; signer?: Signer },
) {
  const signer = options?.signer || provider?.getSigner(options?.addressOrIndex)

  if (!signer) {
    throw new Error('No signer found')
  }

  if (!resolver) {
    resolver = (await contracts?.getPublicResolver()!).address
  }

  switch (contract) {
    case 'registry': {
      const registry = (await contracts?.getRegistry())!.connect(
        provider?.getSigner(options?.addressOrIndex)!,
      )
      return registry.setResolver(namehash(name), resolver)
    }
    case 'nameWrapper': {
      const nameWrapper = (await contracts?.getNameWrapper())!.connect(
        provider?.getSigner(options?.addressOrIndex)!,
      )
      return nameWrapper.setResolver(namehash(name), resolver)
    }
    default: {
      throw new Error(`Unknown contract: ${contract}`)
    }
  }
}
