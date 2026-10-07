"""Assign a new scale reading to one of the configured persons.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

# How much body weight may plausibly drift per day without a measurement.
DRIFT_PER_DAY = 0.15
MAX_DRIFT = 4.0
# Persons without any measurement get the drift allowance of this many days.
NEVER_MEASURED_DAYS = 30

REASON_ONLY_MATCH = "only_match"
REASON_CLOSEST = "closest"
REASON_PRESENCE = "presence"
REASON_NO_MATCH = "no_match"
REASON_AMBIGUOUS = "ambiguous"


@dataclass(frozen=True)
class Candidate:
    """A person the reading could belong to."""

    person_id: str
    # Reference weights, e.g. the trend and the last measured weight.
    references: tuple[float, ...]
    last_measured: datetime | None = None
    # True = at home, False = away, None = unknown / not configured.
    at_home: bool | None = None


@dataclass(frozen=True)
class Detection:
    """Result of a detection run."""

    person_id: str | None
    reason: str
    distances: dict[str, float] = field(default_factory=dict)
    allowed: dict[str, float] = field(default_factory=dict)


def allowed_deviation(candidate: Candidate, now: datetime, tolerance: float) -> float:
    """Return the maximum deviation from the reference for this candidate."""
    if candidate.last_measured is None:
        days = NEVER_MEASURED_DAYS
    else:
        days = max((now - candidate.last_measured).total_seconds() / 86400, 0)
    return tolerance + min(days * DRIFT_PER_DAY, MAX_DRIFT)


def detect(
    weight: float,
    candidates: list[Candidate],
    now: datetime,
    tolerance: float,
    margin: float,
) -> Detection:
    """Find the person a weight reading belongs to.

    1. Only persons whose reference is within the (time dependent) tolerance qualify.
    2. Exactly one qualifies -> that person.
    3. Several qualify and exactly one of them is at home while the others are
       away -> the person at home.
    4. The closest person is at least `margin` closer than the runner-up -> closest.
    5. Otherwise the reading is ambiguous and has to be assigned manually.
    """
    distances = {
        c.person_id: round(min(abs(weight - ref) for ref in c.references), 2)
        for c in candidates
    }
    allowed = {
        c.person_id: round(allowed_deviation(c, now, tolerance), 2) for c in candidates
    }
    inside = sorted(
        (c for c in candidates if distances[c.person_id] <= allowed[c.person_id]),
        key=lambda c: distances[c.person_id],
    )

    if not inside:
        return Detection(None, REASON_NO_MATCH, distances, allowed)
    if len(inside) == 1:
        return Detection(inside[0].person_id, REASON_ONLY_MATCH, distances, allowed)

    home = [c for c in inside if c.at_home]
    if len(home) == 1 and all(c.at_home is False for c in inside if c is not home[0]):
        return Detection(home[0].person_id, REASON_PRESENCE, distances, allowed)

    if distances[inside[1].person_id] - distances[inside[0].person_id] >= margin:
        return Detection(inside[0].person_id, REASON_CLOSEST, distances, allowed)

    return Detection(None, REASON_AMBIGUOUS, distances, allowed)
