import dotenv from 'dotenv';

dotenv.config();

const { runDailyStatsReport } = await import('../src/stats/daily-report.js');

const dateArg = process.argv[2]?.trim();
const fromEnv = process.env.STATS_REPORT_DATE?.trim();
const reportDate = dateArg || fromEnv || undefined;

await runDailyStatsReport(reportDate ? { reportDate } : {});
