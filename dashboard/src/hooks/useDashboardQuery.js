import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/api';
import { QUERY_KEYS, REFETCH_INTERVAL } from '../constants';

// Ye shared dashboard query ko polling aur optional query settings ke saath chalata hai.
export function useDashboardQuery({ clientId, ...options } = {}) {
    return useQuery({
        queryKey: [...QUERY_KEYS.DASHBOARD, clientId || 'all-clients'],
        queryFn: () => analyticsApi.getDashboard(clientId ? { clientId } : undefined),
        refetchInterval: REFETCH_INTERVAL,
        ...options,
    });
}
