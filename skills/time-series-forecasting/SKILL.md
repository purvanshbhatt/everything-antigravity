---
name: time-series-forecasting
disable-model-invocation: true
description: >-
  Builds forecasts that beat honest baselines: framing horizon and
  granularity, data preparation, naive and seasonal-naive baselines, ETS and
  ARIMA, Prophet, gradient boosting with lag features, foundation models such
  as TimesFM, BigQuery ML forecasting, rolling-origin backtests with MASE and
  WAPE, prediction intervals, hierarchies and monitoring. Use when the user
  needs demand, traffic, revenue, capacity or other time-based forecasts.
---

# Time Series Forecasting

A forecast is useful only if it beats a naive baseline on a backtest that
mimics how it will be used, and states its uncertainty honestly. Start
simple and add complexity only when the backtest pays for it.

## When to use

- Demand, sales, traffic, call volume, capacity or cost forecasts.
- An existing forecast is distrusted, or nobody knows whether it beats "same as last week".
- Choosing between statistical models, gradient boosting, foundation models and in-warehouse forecasting.

## When not to use

- Alerting on anomalies in service metrics: `observability-otel`.
- Measuring the impact of a launch or experiment: `ab-testing`.
- Revenue models built from business drivers: `financial-modeling`.

## Workflow

1. **Frame the forecast.** Target, granularity (hour, day, week), horizon (for example 1-28 days), point versus quantiles (capacity planning often needs P90), number of series, decision cadence, and which covariates are known in advance (prices, holidays, promotions) versus unknown.

   **Check:** horizon, granularity, metric and required quantiles are written down.

2. **Prepare the series.** Regular frequency with missing periods filled explicitly (zero sales and missing data are different), timezone and DST handled, incidents and outages flagged rather than deleted, and structural breaks (launches, pricing changes) recorded. Plot every series, or a sample plus the aggregates.

   **Check:** no duplicate or missing timestamps remain within any series.

3. **Set baselines.** Naive (last value), seasonal naive (same period last season), moving average and drift. They define the bar every model must clear.

   **Check:** baseline errors are computed in the backtest from step 4.

4. **Backtest with rolling origins.** Use several cutoffs; at each, train only on data before the cutoff and forecast the full horizon, adding a gap if data arrives late. Metrics: MASE (scaled by seasonal naive; below 1 beats it), WAPE (sum of absolute errors over sum of actuals) for business readers, pinball loss and interval coverage for quantiles. Avoid MAPE when actuals approach zero.

   ```python
   from statsforecast import StatsForecast
   from statsforecast.models import AutoARIMA, AutoETS, SeasonalNaive

   # df columns: unique_id, ds (timestamp), y
   sf = StatsForecast(models=[SeasonalNaive(season_length=7), AutoETS(season_length=7),
                              AutoARIMA(season_length=7)], freq="D", n_jobs=-1)
   cv = sf.cross_validation(df=df, h=28, step_size=7, n_windows=8, level=[80, 95])
   for m in ["SeasonalNaive", "AutoETS", "AutoARIMA"]:
       wape = (cv[m] - cv["y"]).abs().sum() / cv["y"].abs().sum()
       print(m, round(wape, 4))
   ```

   Check argument names against the installed statsforecast version.

   **Check:** a table of model by metric across all cutoffs includes the baselines.

5. **Climb the model ladder only as far as the backtest rewards.**

   | Situation | Model |
   | :--- | :--- |
   | Few series with clear seasonality | ETS or ARIMA (statsforecast); Prophet for several seasonalities and holidays with readable components |
   | Many related series with covariates | One global gradient-boosting model (LightGBM) on lag, rolling and calendar features (for example mlforecast) |
   | Short histories, many series, fast start | Foundation models such as TimesFM (open weights from Google Research); BigQuery ML also offers TimesFM-based forecasting (check current function names and availability) |
   | Data already in BigQuery | BigQuery ML `ARIMA_PLUS` with `ML.FORECAST`; `ARIMA_PLUS_XREG` for covariates |
   | Hierarchies (SKU, store, region) | Forecast base levels and reconcile (MinT; hierarchicalforecast) |

   ```sql
   CREATE OR REPLACE MODEL `proj.ds.sales_arima`
   OPTIONS (model_type = 'ARIMA_PLUS', time_series_timestamp_col = 'day',
            time_series_data_col = 'sales', time_series_id_col = 'store_id',
            holiday_region = 'US') AS
   SELECT day, store_id, sales FROM `proj.ds.daily_sales` WHERE day < '2026-10-01';

   SELECT * FROM ML.FORECAST(MODEL `proj.ds.sales_arima`, STRUCT(28 AS horizon, 0.9 AS confidence_level));
   ```

   **Check:** the chosen model beats seasonal naive on MASE in aggregate and for most series.

6. **Engineer features without leakage.** Lags of at least the horizon (or a recursive or direct multi-step strategy), rolling statistics on the shifted series, calendar and holiday flags, and only covariates truly known in advance (planned price, not realized sales of related series). If you model `log1p(y)`, correct the back-transformed mean or report the median explicitly.

   **Check:** a test confirms that for cutoff T no feature uses data after T.

7. **Quantify uncertainty.** Use model intervals (`level=[80, 95]`), quantile objectives in gradient boosting, or conformal intervals from backtest residuals. Validate empirical coverage on the backtest.

   **Check:** an 80% interval covers roughly 80% of backtest actuals.

8. **Deploy and monitor.** Store every forecast with its series, cutoff, target date and model version so accuracy can be measured later. Track accuracy against actuals, alert on drift, log human overrides separately, and retrain on a schedule. Get user confirmation before replacing a forecast that downstream planning depends on.

   **Check:** the forecast table is keyed by (series, cutoff, target_date, model_version), and an accuracy dashboard exists.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Evaluate on one random split | Rolling-origin backtests | Time order matters; one window is noise |
| Skip the naive baseline | Always report seasonal naive | Fancy models often lose to it |
| Use future-known features that aren't known | Only true known-in-advance covariates | Leakage looks great offline and fails live |
| Report point forecasts for capacity | Quantiles with checked coverage | Planning needs risk, not averages |
| Delete outage periods | Flag them as events | Removal distorts seasonality |
| Overwrite old forecasts | Version and store each run | Accuracy becomes unmeasurable |

## Verification checklist

- [ ] Horizon, granularity, metric and quantiles are defined.
- [ ] Series are regular, with gaps and events handled explicitly.
- [ ] A rolling-origin backtest compares every model with seasonal naive.
- [ ] Features pass the no-future-data test.
- [ ] Interval coverage is validated.
- [ ] Forecasts are versioned and accuracy is monitored.

## Related

- Knowledge: `ml-evaluation`, `bigquery`, `exploratory-data-analysis`, `jupyter-notebooks`, `ml-experiment-tracking`, `etl-pipelines`, `data-visualization`, `financial-modeling`.
- Agents: `data-analyst`, `ml-engineer`.
