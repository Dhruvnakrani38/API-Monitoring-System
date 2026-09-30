import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/api';
import { QUERY_KEYS, REFETCH_INTERVAL } from '../constants';

// Ye shared dashboard query ko polling aur optional query settings ke saath chalata hai.
export function useDashboardQuery(options = {}) {
    return useQuery({
        queryKey: QUERY_KEYS.DASHBOARD,
        queryFn: analyticsApi.getDashboard,
        refetchInterval: REFETCH_INTERVAL,
        ...options,
    });
}
