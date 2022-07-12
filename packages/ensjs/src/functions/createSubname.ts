import { ethers, Signer } from 'ethers'
import { ENSArgs } from '..'
import { FuseOptions } from '../@types/FuseOptions'
import generateFuseInput from '../utils/generateFuseInput'
import { namehash } from '../utils/normalise'

type BaseArgs = {
  name: string
  owner: string
  resolverAddress?: string
  contract: 'registry' | 'nameWrapper'
  options?: { addressOrIndex?: string | number; signer?: Signer }
}

type NameWrapperArgs = {
  contract: 'nameWrapper'
  fuses?: FuseOptions
} & BaseArgs

type Args = BaseArgs | NameWrapperArgs

export default async function (
  { contracts, provider }: ENSArgs<'contracts' | 'provider'>,
  { name, owner, resolverAddress, contract, options, ...wrapperArgs }: Args,
) {
  const signer = options?.signer || provider?.getSigner(options?.addressOrIndex)

  if (!signer) {
    throw new Error('No signer found')
  }

  const labels = name.split('.')

  if (labels.length === 1) {
    throw new Error('Subnames in ENS.js can only be created for 2LDs, not TLDs')
  }

  if ('fuses' in wrapperArgs && contract === 'registry') {
    throw new Error('Fuses can only be set on a wrapped name')
  }

  if (!resolverAddress) {
    resolverAddress = (await contracts?.getPublicResolver())!.address
  }

  const label = labels.shift() as string
  const labelhash = ethers.utils.solidityKeccak256(['string'], [label])
  const parentNodehash = namehash(labels.join('.'))

  switch (contract) {
    case 'registry': {
      const registry = (await contracts?.getRegistry()!).connect(signer)

      return registry.setSubnodeRecord(
        parentNodehash,
        labelhash,
        owner,
        resolverAddress,
        0,
      )
    }
    case 'nameWrapper': {
      const nameWrapper = (await contracts?.getNameWrapper()!).connect(signer)

      const generatedFuses =
        'fuses' in wrapperArgs && wrapperArgs.fuses
          ? generateFuseInput(wrapperArgs.fuses)
          : '0'

      return nameWrapper.setSubnodeRecord(
        parentNodehash,
        label,
        owner,
        resolverAddress,
        0,
        generatedFuses,
      )
    }
    default: {
      throw new Error(`Unknown contract: ${contract}`)
    }
  }
}
