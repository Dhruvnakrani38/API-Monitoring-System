import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { useChartTheme } from '../../hooks/useChartTheme';
import styles from '../../styles/modules/charts/Charts.module.scss';

// Ye component average aur P95 latency ko time ke saath line chart mein dikhata hai.
export function LatencyChart({ data }) {
    const chart = useChartTheme();

    // Theme, axes aur tooltips ke options response-time data ke liye set karo.
    const options = useMemo(() => ({
        chart: {
            type: 'line',
            toolbar: { show: false },
            background: 'transparent',
        },
        theme: { mode: chart.mode },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 3 },
        grid: { borderColor: chart.gridColor, strokeDashArray: 4 },
        xaxis: {
            categories: data?.categories ?? [],
            labels: { style: { colors: chart.labelColor } },
        },
        yaxis: {
            labels: {
                style: { colors: chart.labelColor },
                // Axis labels ko rounded milliseconds mein dikhaye.
                formatter: (v) => `${v.toFixed(0)}ms`,
            },
        },
        colors: ['#6cb9c9', '#c6ef68'],
        tooltip: {
            theme: chart.tooltipTheme,
            // Tooltip mein latency ki precise value dikhaye.
            y: { formatter: (v) => `${v.toFixed(2)}ms` },
        },
        legend: { labels: { colors: chart.labelColor } },
        markers: {
            size: 4,
            colors: ['#6cb9c9', '#c6ef68'],
            strokeWidth: 2,
            strokeColors: chart.strokeColor,
            hover: { size: 6 },
        },
    }), [data?.categories, chart.mode, chart.labelColor, chart.gridColor, chart.tooltipTheme, chart.strokeColor]);

    // Dono latency measurements ko alag chart lines mein badlo.
    const series = useMemo(() => [
        { name: 'Avg Latency', data: data?.avgLatency ?? [] },
        { name: 'P95 Latency', data: data?.p95Latency ?? [] },
    ], [data?.avgLatency, data?.p95Latency]);

    return (
        <Card className={styles.chartCard}>
            <CardHeader>
                <CardTitle>Response Time Analysis</CardTitle>
                <CardDescription>Average and P95 latency metrics</CardDescription>
            </CardHeader>
            <CardContent>
                <Chart options={options} series={series} type="line" height={350} />
            </CardContent>
        </Card>
    );
}
