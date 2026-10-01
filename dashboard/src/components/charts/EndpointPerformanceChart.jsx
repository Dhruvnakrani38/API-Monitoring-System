import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { useChartTheme } from '../../hooks/useChartTheme';
import styles from '../../styles/modules/charts/Charts.module.scss';

// Ye component request volume ke hisab se endpoints ka horizontal chart banata hai.
export function EndpointPerformanceChart({ data }) {
    const chart = useChartTheme();

    // Chart options endpoints ko categories aur active theme ko colors se jodte hain.
    const options = useMemo(() => ({
        chart: {
            type: 'bar',
            toolbar: { show: false },
            background: 'transparent',
        },
        theme: { mode: chart.mode },
        plotOptions: {
            bar: {
                horizontal: true,
                borderRadius: 8,
                dataLabels: { position: 'top' },
            },
        },
        dataLabels: {
            enabled: true,
            offsetX: 30,
            style: { fontSize: '12px', colors: [chart.labelColor] },
            // Hit count ko chart label mein readable number ki tarah dikhaye.
            formatter: (v) => Number(v).toLocaleString(),
        },
        grid: { borderColor: chart.gridColor, strokeDashArray: 4 },
        xaxis: {
            categories: data?.endpoints ?? [],
            labels: { style: { colors: chart.labelColor } },
        },
        yaxis: {
            labels: { style: { colors: chart.labelColor } },
        },
        colors: ['#c6ef68'],
        tooltip: { theme: chart.tooltipTheme },
    }), [data?.endpoints, chart.mode, chart.labelColor, chart.gridColor, chart.tooltipTheme]);

    // Endpoint hit values ko chart ke single data series mein rakho.
    const series = useMemo(() => [
        { name: 'Total Hits', data: data?.hits ?? [] },
    ], [data?.hits]);

    return (
        <Card className={styles.chartCard}>
            <CardHeader>
                <CardTitle>Top Endpoints by Volume</CardTitle>
                <CardDescription>Most requested API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
                <Chart options={options} series={series} type="bar" height={350} />
            </CardContent>
        </Card>
    );
}
