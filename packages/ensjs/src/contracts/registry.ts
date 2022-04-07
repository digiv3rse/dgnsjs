import { ENSRegistry } from '@ensdomains/ens-contracts'
import { ethers } from 'ethers'

const defaultAddress = '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e'

const ABI = ENSRegistry

export const contractInterface = new ethers.utils.Interface(ABI)

export default (provider: ethers.providers.JsonRpcProvider, address?: string) =>
  new ethers.Contract(address || defaultAddress, ABI, provider)
