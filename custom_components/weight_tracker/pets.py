"""Pet weighing by difference: person alone vs. person holding the pet.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

PET_MIN_KG = 0.2
PET_MAX_KG = 80.0


def plausible_for(diff: float, reference: float) -> bool:
    """Return True if a weight difference fits a pet with this reference weight."""
    if not PET_MIN_KG <= diff <= PET_MAX_KG:
        return False
    return abs(diff - reference) <= max(1.0, 0.3 * reference)


def match_pet(diff: float, references: dict[str, float]) -> str | None:
    """Pet whose reference fits the difference best, None if none is plausible.

    Used for automatic suggestions, so it is strict.
    """
    fitting = [
        (abs(diff - ref), pet_id)
        for pet_id, ref in references.items()
        if plausible_for(diff, ref)
    ]
    return min(fitting)[1] if fitting else None


def closest_pet(diff: float, references: dict[str, float]) -> str | None:
    """Pet with the closest reference (explicit weighing: the user said it's a pet)."""
    if not references or not PET_MIN_KG <= diff <= PET_MAX_KG:
        return None
    return min((abs(diff - ref), pet_id) for pet_id, ref in references.items())[1]


def split_pair(first: float, second: float) -> tuple[int, int]:
    """Indexes (alone, with_pet) of two readings: the lighter one is "alone"."""
    return (0, 1) if first <= second else (1, 0)


# Unusually fast changes are an early warning sign (e.g. in cats).
WARN_LOSS_PER_WEEK = 2.0  # % of body weight
WARN_GAIN_PER_WEEK = 3.0
WARN_LOSS_30D = 5.0
WARN_GAIN_30D = 7.0

WARNING_FAST_LOSS = "fast_loss"
WARNING_FAST_GAIN = "fast_gain"
WARNING_LOSS = "loss_30d"
WARNING_GAIN = "gain_30d"


def health_warning(
    trend: float | None, rate_per_week: float | None, change_30d: float | None
) -> tuple[str, float] | None:
    """(warning code, percent) if a pet's weight changes unusually fast."""
    if not trend:
        return None
    if rate_per_week is not None:
        weekly = rate_per_week / trend * 100
        if weekly <= -WARN_LOSS_PER_WEEK:
            return WARNING_FAST_LOSS, round(weekly, 1)
        if weekly >= WARN_GAIN_PER_WEEK:
            return WARNING_FAST_GAIN, round(weekly, 1)
    if change_30d is not None:
        monthly = change_30d / trend * 100
        if monthly <= -WARN_LOSS_30D:
            return WARNING_LOSS, round(monthly, 1)
        if monthly >= WARN_GAIN_30D:
            return WARNING_GAIN, round(monthly, 1)
    return None
