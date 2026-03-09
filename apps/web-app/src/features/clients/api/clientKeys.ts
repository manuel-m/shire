export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (params: { page: number; limit: number }) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  contacts: (id: string) => [...clientKeys.detail(id), 'contacts'] as const,
  search: (query: string) => [...clientKeys.all, 'search', query] as const,
};
