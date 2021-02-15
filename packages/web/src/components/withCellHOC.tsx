import type { DocumentNode } from 'graphql'

import { useSubscription, OperationResult } from './GraphQLHooksProvider'
// import { useQuery, OperationResult } from './GraphQLHooksProvider'

const Subscription: React.FunctionComponent<{
  subscription: DocumentNode
  children: (result: OperationResult) => React.ReactElement
}> = ({ children, subscription, ...rest }) => {
  const result = useSubscription(subscription, rest)
  return children && result ? children(result) : null
}

export type DataObject = { [key: string]: unknown }

export type CellFailureStateComponent = Omit<
  OperationResult,
  'data' | 'loading'
>
export type CellLoadingEmptyStateComponent = Omit<
  OperationResult,
  'error' | 'loading' | 'data'
>
export type CellSuccessStateComponent =
  | Omit<OperationResult, 'error' | 'loading' | 'data'>
  | DataObject

export interface WithCellProps {
  beforeSubscription?: <TProps>(props: TProps) => { variables: TProps }
  // @ts-expect-error We do not know, and even really care, what they are here.
  SUBSCRIPTION: DocumentNode | (({ variables: unknown }) => DocumentNode)
  afterSubscription?: (data: DataObject) => DataObject
  Loading?: React.FC<CellLoadingEmptyStateComponent>
  Failure?: React.FC<CellFailureStateComponent>
  Empty?: React.FC<CellLoadingEmptyStateComponent>
  Success: React.FC<CellSuccessStateComponent>
}

/**
 * Is a higher-order-component that executes a GraphQL query and automatically
 * manages the lifecycle of that query. If you export named parameters that match
 * the required params of `withCell` it will be automatically wrapped in this
 * HOC via a babel-plugin.
 *
 * @param {string} SUBSCRIPTION - The graphQL syntax tree to execute
 * @param {function=} beforeSubscription - Prepare the variables and options for the query
 * @param {function=} afterSubscription - Sanitize the data return from graphQL
 * @param {Component=} Loading - Loading, render this component
 * @param {Component=} Empty - Loading, render this component
 * @param {Component=} Failure - Something went wrong, render this component
 * @param {Component} Success - Data has loaded, render this component
 *
 * @example
 * ```js
 * // IMPLEMENTATION:
 * // `src/ExampleComponent/index.js`. This file is automatically dealt with
 * in webpack.
 *
 * import { withCell } from '@redwoodjs/web'
 * import * as cell from './ExampleComponent'
 *
 * export default withCell(cell)
 * ```
 *
 * // USAGE:
 * // Now you have a cell component that will handle the lifecycle methods of
 * // a query
 * import ExampleComponent from 'src/ExampleComponent'
 *
 * const ThingThatUsesExampleComponent = () => {
 *  return <div><ExampleComponent /></div>
 * }
 */
export const withCell = ({
  beforeSubscription = (props) => ({
    variables: props,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  }),
  SUBSCRIPTION,
  afterSubscription = (data) => ({ ...data }),
  Loading = () => <>Loading...</>,
  Failure,
  Empty,
  Success,
}: WithCellProps) => {
  const isDataNull = (data: DataObject) => {
    return dataField(data) === null
  }

  const isDataEmptyArray = (data: DataObject) => {
    const field = dataField(data)
    return Array.isArray(field) && field.length === 0
  }

  const dataField = (data: DataObject) => {
    return data[Object.keys(data)[0]]
  }

  const isEmpty = (data: DataObject) => {
    return isDataNull(data) || isDataEmptyArray(data)
  }

  return (props: Record<string, unknown>) => (
    <Subscription
      subscription={
        typeof SUBSCRIPTION === 'function'
          ? SUBSCRIPTION(beforeSubscription(props))
          : SUBSCRIPTION
      }
      {...beforeSubscription(props)}
    >
      {({ error, loading, data, ...subscriptionRest }) => {
        if (error) {
          if (Failure) {
            return <Failure error={error} {...subscriptionRest} {...props} />
          } else {
            throw error
          }
        } else if (loading) {
          return <Loading {...subscriptionRest} {...props} />
        } else if (data) {
          if (typeof Empty !== 'undefined' && isEmpty(data)) {
            return <Empty {...subscriptionRest} {...props} />
          } else {
            return (
              <Success
                {...afterSubscription(data)}
                {...subscriptionRest}
                {...props}
              />
            )
          }
        } else {
          throw new Error(
            'Cannot render cell: GraphQL success but `data` is null'
          )
        }
      }}
    </Subscription>
  )
}
