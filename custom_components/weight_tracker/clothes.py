"""Weight of clothes: learned from measurements a person marked "with clothes".

For every marked measurement the offset to the person's weight without clothes
around that time (unmarked measurements within REFERENCE_WINDOW, nearest first)
is a sample. The learned value is the median of the recent samples, pulled
towards the person's start value while there are only a few samples.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from statistics import median

DEFAULT_CLOTHES_KG = 0.8
MIN_CLOTHES_KG = 0.0
MAX_CLOTHES_KG = 4.0
REFERENCE_WINDOW = timedelta(hours=36)
RECENT_SAMPLES = 12
PRIOR_WEIGHT = 2  # the start value counts like this many samples


def offset_samples(
    marked: list[tuple[datetime, float]],
    unmarked: list[tuple[datetime, float]],
) -> list[float]:
    """Raw weight with clothes minus the nearest weight without clothes."""
    samples = []
    for ts, weight in marked:
        nearby = [(abs(ts - uts), uw) for uts, uw in unmarked if abs(ts - uts) <= REFERENCE_WINDOW]
        if not nearby:
            continue
        reference = min(nearby, key=lambda item: item[0])[1]
        offset = weight - reference
        if MIN_CLOTHES_KG <= offset <= MAX_CLOTHES_KG:
            samples.append(offset)
    return samples


def learned_clothes(start: float, samples: list[float]) -> float:
    """Median of the recent samples, shrunk towards the start value."""
    recent = samples[-RECENT_SAMPLES:]
    if not recent:
        return round(start, 2)
    value = (start * PRIOR_WEIGHT + median(recent) * len(recent)) / (PRIOR_WEIGHT + len(recent))
    return round(min(MAX_CLOTHES_KG, max(MIN_CLOTHES_KG, value)), 2)
