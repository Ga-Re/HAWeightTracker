"""Statistics for a person's weight history.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

# Exponential smoothing as in "The Hacker's Diet": the trend moves 10 % per day
# towards the measured weight. Scaled by the time between measurements.
TREND_DAILY_FACTOR = 0.9
MIN_TREND_STEP_DAYS = 0.5
RATE_WINDOW_DAYS = 28
RATE_MIN_POINTS = 3
RATE_MIN_SPAN_DAYS = 5
GOAL_REACHED_TOLERANCE = 0.2
MAX_GOAL_WEEKS = 260


@dataclass(frozen=True)
class Point:
    """A single assigned measurement."""

    ts: datetime
    weight: float


@dataclass
class PersonStats:
    """Derived values for one person."""

    count: int = 0
    latest_weight: float | None = None
    latest_ts: datetime | None = None
    previous_weight: float | None = None
    change_last: float | None = None
    trend: float | None = None
    change_7d: float | None = None
    change_30d: float | None = None
    change_total: float | None = None
    rate_per_week: float | None = None
    min_weight: float | None = None
    max_weight: float | None = None
    first_weight: float | None = None
    first_ts: datetime | None = None
    bmi: float | None = None
    goal: float | None = None
    goal_remaining: float | None = None
    goal_reached: bool | None = None
    goal_eta: date | None = None


def trend_series(points: list[Point]) -> list[tuple[datetime, float]]:
    """Return the smoothed trend value after each measurement."""
    series: list[tuple[datetime, float]] = []
    trend: float | None = None
    prev_ts: datetime | None = None
    for point in points:
        if trend is None or prev_ts is None:
            trend = point.weight
        else:
            days = max((point.ts - prev_ts).total_seconds() / 86400, MIN_TREND_STEP_DAYS)
            alpha = 1 - TREND_DAILY_FACTOR**days
            trend += alpha * (point.weight - trend)
        prev_ts = point.ts
        series.append((point.ts, trend))
    return series


def trend_at(series: list[tuple[datetime, float]], when: datetime) -> float | None:
    """Return the trend value valid at `when` (None if no data before)."""
    value = None
    for ts, trend in series:
        if ts > when:
            break
        value = trend
    return value


def weekly_rate(points: list[Point], now: datetime) -> float | None:
    """Linear regression over the last weeks, in kg per week."""
    recent = [p for p in points if p.ts >= now - timedelta(days=RATE_WINDOW_DAYS)]
    if len(recent) < RATE_MIN_POINTS:
        return None
    xs = [(p.ts - recent[0].ts).total_seconds() / 86400 for p in recent]
    if xs[-1] - xs[0] < RATE_MIN_SPAN_DAYS:
        return None
    ys = [p.weight for p in recent]
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    sxx = sum((x - mean_x) ** 2 for x in xs)
    if sxx == 0:
        return None
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)) / sxx
    return slope * 7


def compute_stats(
    points: list[Point],
    now: datetime,
    *,
    height_cm: float | None = None,
    goal: float | None = None,
) -> PersonStats:
    """Compute all statistics for one person."""
    stats = PersonStats(count=len(points), goal=goal)
    if not points:
        return stats

    points = sorted(points, key=lambda p: p.ts)
    series = trend_series(points)
    latest = points[-1]
    trend = series[-1][1]

    stats.latest_weight = latest.weight
    stats.latest_ts = latest.ts
    stats.trend = round(trend, 2)
    stats.first_weight = points[0].weight
    stats.first_ts = points[0].ts
    stats.min_weight = min(p.weight for p in points)
    stats.max_weight = max(p.weight for p in points)
    stats.change_total = round(trend - points[0].weight, 2)

    if len(points) > 1:
        stats.previous_weight = points[-2].weight
        stats.change_last = round(latest.weight - points[-2].weight, 2)

    for days, attr in ((7, "change_7d"), (30, "change_30d")):
        past = trend_at(series, now - timedelta(days=days))
        if past is not None:
            setattr(stats, attr, round(trend - past, 2))

    rate = weekly_rate(points, now)
    if rate is not None:
        stats.rate_per_week = round(rate, 2)

    if height_cm:
        stats.bmi = round(latest.weight / (height_cm / 100) ** 2, 1)

    if goal is not None:
        remaining = goal - trend
        stats.goal_remaining = round(remaining, 2)
        stats.goal_reached = abs(remaining) <= GOAL_REACHED_TOLERANCE
        if stats.goal_reached:
            stats.goal_eta = now.date()
        elif rate is not None and rate * remaining > 0:
            weeks = remaining / rate
            if weeks <= MAX_GOAL_WEEKS:
                stats.goal_eta = (now + timedelta(weeks=weeks)).date()

    return stats
