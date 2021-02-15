import {
  ApolloProvider,
  ApolloClientOptions,
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  useSubscription,
  useMutation,
  createHttpLink,
  split,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { WebSocketLink } from '@apollo/client/link/ws'
import { getMainDefinition } from '@apollo/client/utilities'

import { AuthContextInterface, useAuth } from '@redwoodjs/auth'

import {
  FetchConfigProvider,
  useFetchConfig,
} from 'src/components/FetchConfigProvider'
import { GraphQLHooksProvider } from 'src/components/GraphQLHooksProvider'
import { FlashProvider } from 'src/flash'

const ApolloProviderWithFetchConfig: React.FunctionComponent<{
  config?: Omit<ApolloClientOptions<InMemoryCache>, 'cache'>
}> = ({ config = {}, children }) => {
  const { uri, headers } = useFetchConfig()
  const { getToken, type: authProviderType, isAuthenticated } = useAuth()

  const withToken = setContext(async () => {
    if (isAuthenticated && getToken) {
      const token = await getToken()

      return { token }
    }

    return { token: null }
  })

  const authMiddleware = new ApolloLink((operation, forward) => {
    const { token } = operation.getContext()

    // Only add auth headers when token is present
    // Token is null, when !isAuthenticated
    const authHeaders = token
      ? {
          'auth-provider': authProviderType,
          authorization: `Bearer ${token}`,
        }
      : {}

    operation.setContext(() => ({
      headers: {
        ...headers,
        // Duped auth headers, because we may remove FetchContext at a later date
        ...authHeaders,
      },
    }))
    return forward(operation)
  })

  const httpLink = createHttpLink({ uri })

  const wsUri = uri.startsWith('https')
    ? uri.replace(/^https/, 'wss')
    : uri.replace(/^http/, 'ws')

  const wsLink = new WebSocketLink({
    // uri: 'ws://hasura-c5bf08c5.nhost.app/v1/graphql',
    uri: wsUri,
    options: {
      reconnect: true,
    },
  })

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      )
    },
    // wsLink,
    wsLink,
    httpLink
  )

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    ...config,
    link: ApolloLink.from([withToken, authMiddleware.concat(splitLink)]),
    // link: splitLink,
  })

  return <ApolloProvider client={client}>{children}</ApolloProvider>
}

export const RedwoodApolloProvider: React.FunctionComponent<{
  graphQLClientConfig?: Omit<ApolloClientOptions<InMemoryCache>, 'cache'>
  useAuth: () => AuthContextInterface
}> = ({ graphQLClientConfig, useAuth, children }) => {
  return (
    <FetchConfigProvider useAuth={useAuth}>
      <ApolloProviderWithFetchConfig config={graphQLClientConfig}>
        <GraphQLHooksProvider
          useSubscription={useSubscription}
          useMutation={useMutation}
        >
          <FlashProvider>{children}</FlashProvider>
        </GraphQLHooksProvider>
      </ApolloProviderWithFetchConfig>
    </FetchConfigProvider>
  )
}
