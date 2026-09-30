// Ye analytics queries ke cache keys ko ek shared object mein rakhta hai.
export const QUERY_KEYS = {
    DASHBOARD: ['dashboard'],
    STATS: ['stats'],
    TOP_ENDPOINTS: ['topEndpoints'],
    TIME_SERIES: ['timeSeries'],
};

// Ye dashboard polling ke beech ka samay milliseconds mein set karta hai.
export const REFETCH_INTERVAL = 30_000;
