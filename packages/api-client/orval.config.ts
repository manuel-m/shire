import { defineConfig } from 'orval';

export default defineConfig({
  shire: {
    input: {
      target: '../../services/bff-service/openapi.json',
    },
    output: {
      target: './src/generated/',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './src/fetcher.ts',
          name: 'customFetcher',
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
