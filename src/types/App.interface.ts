
export interface IApp {
    id: string;
    app_name: string;
    duration: number;
    formatted_duration: string;
}

export interface IAppDailyUsage {
    date: string;               // "YYYY-MM-DD"
    duration: number;           // seconds
    formatted_duration: string;
}

export interface INotificationRule {
    id?: number;
    app_name: string;
    threshold_seconds: number;
    message: string;
    enabled: boolean;
}

export interface IMonitoringTrend {
    date: string;           // "YYYY-MM-DD"
    total_seconds: number;
}

export interface IDashboardData {
    apps: IApp[];
    yesterday_apps: IApp[];
    monitoring_seconds: number;
    total_seconds_today: number;
    active_apps: string[];
    trend_data: IMonitoringTrend[];
}
