"""Milestones (achievements) and streaks of a person.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

# Progress towards the goal direction (kg lost, or gained for a gain goal)
CHANGE_STEPS = (1, 2, 3, 5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50)
STREAK_STEPS = (7, 14, 30, 60, 100, 200, 365)
COUNT_STEPS = (10, 50, 100, 250, 500, 1000)
GOAL_TOLERANCE = 0.2
NEW_LOW_MIN_POINTS = 5
NEW_LOW_MARGIN = 0.05

KIND_CHANGE = "change"
KIND_GOAL = "goal"
KIND_STREAK = "streak"
KIND_COUNT = "count"


@dataclass(frozen=True)
class Milestone:
    """Something a person achieved."""

    id: str
    kind: str
    value: float


def direction(first_weight: float, goal: float | None) -> int:
    """-1 = losing weight (default), +1 = gaining (goal above the start)."""
    return 1 if goal is not None and goal > first_weight else -1


def _fmt(value: float) -> str:
    return f"{value:g}"


def longest_streak(days: list[date]) -> int:
    """Longest run of consecutive days with at least one measurement."""
    unique = sorted(set(days))
    best = run = 0
    previous: date | None = None
    for day in unique:
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best


def current_streak(days: list[date], today: date) -> int:
    """Consecutive days up to today (or yesterday, if today is still open)."""
    unique = set(days)
    start = today if today in unique else today - timedelta(days=1)
    streak = 0
    while start - timedelta(days=streak) in unique:
        streak += 1
    return streak


def achieved(
    weights: list[float],
    trends: list[float],
    days: list[date],
    goal: float | None,
) -> list[Milestone]:
    """All milestones reached by this history (oldest measurement first)."""
    if not weights:
        return []
    first = weights[0]
    sign = direction(first, goal)
    best = max(sign * (trend - first) for trend in trends)
    result = [
        Milestone(f"{KIND_CHANGE}_{_fmt(step)}", KIND_CHANGE, sign * step)
        for step in CHANGE_STEPS
        if best >= step
    ]
    if goal is not None and any(sign * (trend - goal) >= -GOAL_TOLERANCE for trend in trends):
        result.append(Milestone(f"{KIND_GOAL}_{_fmt(goal)}", KIND_GOAL, goal))
    streak = longest_streak(days)
    result += [
        Milestone(f"{KIND_STREAK}_{step}", KIND_STREAK, step)
        for step in STREAK_STEPS
        if streak >= step
    ]
    result += [
        Milestone(f"{KIND_COUNT}_{step}", KIND_COUNT, step)
        for step in COUNT_STEPS
        if len(weights) >= step
    ]
    return result


def next_change_step(weights: list[float], trends: list[float], goal: float | None) -> tuple[float, float] | None:
    """(next step, kg still needed) towards the next change milestone."""
    if not weights:
        return None
    first = weights[0]
    sign = direction(first, goal)
    best = max(sign * (trend - first) for trend in trends)
    current = sign * (trends[-1] - first)
    for step in CHANGE_STEPS:
        if best < step:
            return sign * step, round(step - current, 2)
    return None


def is_new_low(trends: list[float], goal_sign: int) -> bool:
    """The latest trend is the best so far (lowest when losing, highest when gaining)."""
    if len(trends) < NEW_LOW_MIN_POINTS:
        return False
    latest = trends[-1]
    return all(goal_sign * (latest - previous) > NEW_LOW_MARGIN for previous in trends[:-1])
