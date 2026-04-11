
export interface IApp {
    id: string;
    app_name: string;
    duration: number;
    formatted_duration: string;
    logo_base64: string;
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
