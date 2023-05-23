import { gql } from 'graphql-request'
import { ClientWithEns } from '../../contracts/addContracts'
import { GRACE_PERIOD_SECONDS } from '../../utils/consts'
import { namehash } from '../../utils/normalise'
import { createSubgraphClient } from './client'
import {
  SubgraphDomain,
  domainDetailsWithoutParentFragment,
  registrationDetailsFragment,
  wrappedDomainDetailsFragment,
} from './fragments'
import { Name, makeNameObject } from './utils'

type GetSubnamesOrderBy = 'expiryDate' | 'name' | 'labelName' | 'createdAt'

export type GetSubnamesParameters = {
  name: string

  searchString?: string
  allowExpired?: boolean
  orderBy?: GetSubnamesOrderBy
  orderDirection?: 'asc' | 'desc'

  previousPage?: Name[]
  pageSize?: number
}

export type GetSubnamesReturnType = Name[]

type SubgraphResult = {
  domain?: {
    subdomains: SubgraphDomain[]
  }
}

const getSubnames = async (
  client: ClientWithEns,
  {
    name,
    searchString,
    allowExpired = false,
    orderBy = 'name',
    orderDirection = 'asc',
    pageSize = 100,
    previousPage,
  }: GetSubnamesParameters,
): Promise<GetSubnamesReturnType> => {
  const subgraphClient = createSubgraphClient({ client })

  const whereFilters: string[] = []

  let orderByFilter = ''
  let orderByStringVar = ''

  if (previousPage && previousPage.length > 0) {
    const lastDomain = previousPage[previousPage.length - 1]
    const operator = orderDirection === 'asc' ? 'gt' : 'lt'
    switch (orderBy) {
      case 'expiryDate': {
        let lastExpiryDate = lastDomain.expiryDate?.value
          ? lastDomain.expiryDate.value / 1000
          : 0
        if (name === 'eth' && lastExpiryDate) {
          lastExpiryDate += GRACE_PERIOD_SECONDS
        }
        if (orderDirection === 'asc' && lastExpiryDate === 0) {
          orderByFilter = `
              {
                and: [
                  { expiryDate: null }
                  { id_${operator}: "${lastDomain.id}" }
                ]
              }
            `
        } else if (orderDirection === 'desc' && lastExpiryDate !== 0) {
          orderByFilter = `
            {
              expiryDate_${operator}: ${lastExpiryDate}
            }
          `
        } else {
          orderByFilter = `
            {
              or: [
                {
                  expiryDate_${operator}: ${lastExpiryDate}
                }
                { expiryDate: null }
              ]
            }
          `
        }
        break
      }
      case 'name': {
        orderByFilter = `
          {
            name_${operator}: $orderByStringVar
          }
        `
        orderByStringVar = lastDomain.name ?? ''
        break
      }
      case 'labelName': {
        orderByFilter = `
          {
            labelName_${operator}: $orderByStringVar
          }
        `
        orderByStringVar = lastDomain.labelName ?? ''
        break
      }
      case 'createdAt': {
        orderByFilter = `
          {
            createdAt_${operator}: ${lastDomain.createdAt.value / 1000}
          }
        `
        break
      }
      default:
        throw new Error(`Invalid orderBy: ${orderBy}`)
    }
    whereFilters.push(orderByFilter)
  }

  if (!allowExpired) {
    // Exclude domains that are expired
    // if expiryDate is null, there is no expiry on the domain (registration or wrapped)
    whereFilters.push(`
      {
        or: [
          { expiryDate_gt: $expiryDate }
          { expiryDate: null }
        ]
      }
    `)
  }

  if (searchString) {
    // using labelName_contains instead of name_contains because name_contains
    // includes the parent name
    whereFilters.push(`
      {
        labelName_contains: $searchString
      }
    `)
  }

  let whereFilter = ''

  if (whereFilters.length > 1) {
    whereFilter = `
      and: [
        ${whereFilters.join('\n')}
      ]
    `
  } else if (whereFilters.length === 1) {
    whereFilter = whereFilters[0].replace(/{(.*)}/gs, '$1')
  }

  const query = gql`
    query getSubnames(
      $id: String!
      $orderBy: Domain_orderBy
      $orderDirection: OrderDirection
      $first: Int
      $expiryDate: Int
      $searchString: String
      $orderByStringVar: String
    ) {
      domain(id: $id) {
        subdomains(
          orderBy: $orderBy
          orderDirection: $orderDirection
          first: $first
          ${
            whereFilter &&
            `
          where: {
            ${whereFilter}
          }
          `
          }
        ) {
          ...DomainDetailsWithoutParent
          registration {
            ...RegistrationDetails
          }
          wrappedDomain {
            ...WrappedDomainDetails
          }
        }
      }
    }
    ${domainDetailsWithoutParentFragment}
    ${registrationDetailsFragment}
    ${wrappedDomainDetailsFragment}
  `

  const queryVars = {
    id: namehash(name),
    orderBy,
    orderDirection,
    first: pageSize,
    expiryDate: Math.floor(Date.now() / 1000),
    searchString,
    orderByStringVar,
  }

  const result = await subgraphClient.request<SubgraphResult, typeof queryVars>(
    query,
    queryVars,
  )

  if (!result.domain) return []

  const names = result.domain.subdomains.map((domain) =>
    makeNameObject({ ...domain, parent: { name } }),
  )

  return names
}

export default getSubnames