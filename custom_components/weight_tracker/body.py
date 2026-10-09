"""Body composition from bioelectrical impedance, classifications, waist-to-height.

Uses the widely used formulas of Xiaomi body composition scales (as in openScale
and the bodymiscale integration). They are estimates, not medical values.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from dataclasses import dataclass

MALE = "male"
FEMALE = "female"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class Composition:
    """Estimated body composition of one measurement."""

    body_fat: float  # %
    water: float | None = None  # %
    bone_mass: float | None = None  # kg
    muscle_mass: float | None = None  # kg
    bmr: float | None = None  # kcal / day


def plausible_input(weight: float, height_cm: float, age: int, impedance: float) -> bool:
    """The formulas are only valid in these ranges."""
    return 10 <= weight <= 200 and 100 <= height_cm <= 220 and 6 <= age <= 99 and 50 <= impedance <= 3000


def _lbm(weight: float, height: float, age: int, impedance: float) -> float:
    lbm = (height * 9.058 / 100) * (height / 100)
    lbm += weight * 0.32 + 12.226
    lbm -= impedance * 0.0068
    lbm -= age * 0.0542
    return lbm


def from_impedance(weight: float, height_cm: float, age: int, sex: str, impedance: float) -> Composition | None:
    """Estimate the composition; None if inputs are outside the valid range."""
    if sex not in (MALE, FEMALE) or not plausible_input(weight, height_cm, age, impedance):
        return None
    female = sex == FEMALE
    lbm = _lbm(weight, height_cm, age, impedance)

    const = (9.25 if age <= 49 else 7.25) if female else 0.8
    if not female and weight < 61:
        coefficient = 0.98
    elif female and weight > 60:
        coefficient = 0.96 * (1.03 if height_cm > 160 else 1.0)
    elif female and weight < 50:
        coefficient = 1.02 * (1.03 if height_cm > 160 else 1.0)
    else:
        coefficient = 1.0
    fat = (1.0 - ((lbm - const) * coefficient) / weight) * 100
    fat = _clamp(75 if fat > 63 else fat, 5, 75)

    water = (100 - fat) * 0.7
    water *= 1.02 if water <= 50 else 0.98
    water = _clamp(75 if water >= 65 else water, 35, 75)

    base = 0.245691014 if female else 0.18016894
    bone = (base - lbm * 0.05158) * -1
    bone += 0.1 if bone > 2.2 else -0.1
    if (female and bone > 5.1) or (not female and bone > 5.2):
        bone = 8
    bone = _clamp(bone, 0.5, 8)

    muscle = weight - fat * 0.01 * weight - bone
    if (female and muscle >= 84) or (not female and muscle >= 93.5):
        muscle = 120
    muscle = _clamp(muscle, 10, 120)

    if female:
        bmr = 864.6 + weight * 10.2036 - height_cm * 0.39336 - age * 6.204
    else:
        bmr = 877.8 + weight * 14.916 - height_cm * 0.726 - age * 8.976
    bmr = _clamp(bmr, 500, 10000)

    return Composition(
        body_fat=round(fat, 1),
        water=round(water, 1),
        bone_mass=round(bone, 2),
        muscle_mass=round(muscle, 1),
        bmr=round(bmr),
    )


# Healthy body fat ranges by sex and age (Gallagher et al. 2000):
# (max age, lower bound, upper healthy bound, upper "increased" bound)
_FAT_RANGES = {
    MALE: ((39, 8, 19, 24), (59, 11, 21, 27), (200, 13, 24, 29)),
    FEMALE: ((39, 21, 32, 38), (59, 23, 33, 39), (200, 24, 35, 41)),
}


def body_fat_class(body_fat: float, sex: str | None, age: int | None) -> str | None:
    """low / healthy / high / very_high, None without sex or for minors."""
    if sex not in _FAT_RANGES or age is None or age < 18:
        return None
    for max_age, low, healthy, high in _FAT_RANGES[sex]:
        if age <= max_age:
            if body_fat < low:
                return "low"
            if body_fat <= healthy:
                return "healthy"
            if body_fat <= high:
                return "high"
            return "very_high"
    return None


def body_fat_range(sex: str | None, age: int | None) -> tuple[float, float] | None:
    """Healthy body fat range (%) for display."""
    if sex not in _FAT_RANGES or age is None or age < 18:
        return None
    for max_age, low, healthy, _ in _FAT_RANGES[sex]:
        if age <= max_age:
            return low, healthy
    return None


def age_from_birth_month(birth_month: str | None, year: int, month: int) -> int | None:
    """Age in years from "YYYY-MM" at the given year/month."""
    try:
        birth_year, birth_month_num = (int(part) for part in str(birth_month).split("-")[:2])
    except (TypeError, ValueError):
        return None
    age = year - birth_year - (1 if month < birth_month_num else 0)
    return age if 0 <= age < 130 else None


def waist_to_height(waist_cm: float, height_cm: float | None) -> float | None:
    """Waist-to-height ratio (WHtR)."""
    if not height_cm or waist_cm <= 0:
        return None
    return round(waist_cm / height_cm, 2)


def whtr_class(ratio: float, age: int | None = None) -> str:
    """low / healthy / increased / high. From 50 the healthy limit rises (Ashwell)."""
    healthy_limit = 0.5 if age is None or age < 50 else 0.5 + min(age - 50, 10) * 0.01
    if ratio < 0.4:
        return "low"
    if ratio < healthy_limit:
        return "healthy"
    if ratio < 0.6:
        return "increased"
    return "high"
