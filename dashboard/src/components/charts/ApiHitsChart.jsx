import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui';
import { useChartTheme } from '../../hooks/useChartTheme';
import styles from '../../styles/modules/charts/Charts.module.scss';

// Ye component hit totals ko prepare karke traffic bar chart render karta hai.
export function ApiHitsChart({ stats }) {
    const chart = useChartTheme();

    const isEmpty = !stats || (stats.totalHits === 0 && stats.successHits === 0 && stats.errorHits === 0);

    // Chart ke labels, rang aur theme options yahan tayyar hote hain.
    const options = useMemo(() => ({
        chart: {
            type: 'bar',
            toolbar: { show: false },
            background: 'transparent',
        },
        theme: { mode: chart.mode },
        plotOptions: {
            bar: { borderRadius: 6, columnWidth: '45%', distributed: true },
        },
        dataLabels: { enabled: false },
        grid: { borderColor: chart.gridColor, strokeDashArray: 4 },
        xaxis: {
            categories: ['Total Hits', 'Success', 'Errors'],
            labels: { style: { colors: chart.labelColor } },
        },
        yaxis: {
            labels: { style: { colors: chart.labelColor } },
        },
        colors: ['#6cb9c9', '#c6ef68', '#f07c6c'],
        legend: { show: false },
        tooltip: { theme: chart.tooltipTheme },
    }), [chart.mode, chart.labelColor, chart.gridColor, chart.tooltipTheme]);

    // API stats ko ApexCharts ke series format mein badla jata hai.
    const series = useMemo(() => [{
        name: 'Hits',
        data: [
            stats?.totalHits ?? 0,
            stats?.successHits ?? 0,
            stats?.errorHits ?? 0,
        ],
    }], [stats?.totalHits, stats?.successHits, stats?.errorHits]);

    return (
        <Card className={styles.chartCard}>
            <CardHeader>
                <CardTitle>API Traffic Summary</CardTitle>
                <CardDescription>Total, success and error hit counts</CardDescription>
            </CardHeader>
            <CardContent>
                {isEmpty ? (
                    <div className={styles.emptyChart}>
                        <p>No traffic data available yet</p>
                        <span>Data will appear once API requests are ingested</span>
                    </div>
                ) : (
                    <Chart options={options} series={series} type="bar" height={350} />
                )}
            </CardContent>
        </Card>
    );
}
