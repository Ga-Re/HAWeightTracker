"""Body composition from bioelectrical impedance, classifications, waist-to-height.

Uses the widely used formulas of Xiaomi body composition scales (as in openScale
and the bodymiscale integration). They are estimates, not medical values.

The extended analysis (body score, visceral fat, metabolic age, protein, body
type, weight suggestions and the Xiaomi rating tables) follows the algorithms
documented by bodymiscale (https://github.com/dckiller51/bodymiscale,
Apache License 2.0), re-implemented here.

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from dataclasses import dataclass
import math

MALE = "male"
FEMALE = "female"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass(frozen=True)
class Composition:
    """Estimated body composition of one measurement."""

    body_fat: float | None = None  # %
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


MODEL_STANDARD = "standard"  # formulas of common foot-to-foot body composition scales
MODEL_SUN = "sun"  # Sun et al. 2003 (NHANES III), published BIA equation
BODY_MODELS = (MODEL_STANDARD, MODEL_SUN)


def estimate(model: str, weight: float, height_cm: float, age: int, sex: str, impedance: float) -> Composition | None:
    """Body composition with the chosen set of formulas."""
    if model == MODEL_SUN:
        return from_sun(weight, height_cm, age, sex, impedance)
    return from_impedance(weight, height_cm, age, sex, impedance)


def from_sun(weight: float, height_cm: float, age: int, sex: str, impedance: float) -> Composition | None:
    """Sun et al. (2003): fat-free mass from the impedance index height²/R.

    Water is 73.2 % of the fat-free mass, bone mineral 4.2 %, muscle the rest;
    basal metabolic rate after Katch-McArdle. Developed with hand-to-foot
    measurements, so foot-to-foot scales tend to give lower body fat.
    """
    if sex not in (MALE, FEMALE) or not plausible_input(weight, height_cm, age, impedance) or age < 12:
        return None
    index = height_cm * height_cm / impedance
    if sex == MALE:
        ffm = -10.68 + 0.65 * index + 0.26 * weight + 0.02 * impedance
    else:
        ffm = -9.53 + 0.69 * index + 0.17 * weight + 0.02 * impedance
    ffm = _clamp(ffm, weight * 0.4, weight * 0.97)
    bone = ffm * 0.042
    return Composition(
        body_fat=round((weight - ffm) / weight * 100, 1),
        water=round(ffm * 0.732 / weight * 100, 1),
        bone_mass=round(bone, 2),
        muscle_mass=round(ffm - bone, 1),
        bmr=round(370 + 21.6 * ffm),
    )


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


# Xiaomi rating tables. Body fat: (min age, max age, female, male) with
# [very low, low, normal upper limit, high upper limit] in percent.
_FAT_SCALES = (
    (0, 12, (12.0, 21.0, 30.0, 34.0), (7.0, 16.0, 25.0, 30.0)),
    (12, 14, (15.0, 24.0, 33.0, 37.0), (7.0, 16.0, 25.0, 30.0)),
    (14, 16, (18.0, 27.0, 36.0, 40.0), (7.0, 16.0, 25.0, 30.0)),
    (16, 18, (20.0, 28.0, 37.0, 41.0), (7.0, 16.0, 25.0, 30.0)),
    (18, 40, (21.0, 28.0, 35.0, 40.0), (11.0, 17.0, 22.0, 27.0)),
    (40, 60, (22.0, 29.0, 36.0, 41.0), (12.0, 18.0, 23.0, 28.0)),
    (60, 200, (23.0, 30.0, 37.0, 42.0), (14.0, 20.0, 25.0, 30.0)),
)
# Muscle mass by height: (min height male, min height female, female, male) with [low, normal] in kg.
_MUSCLE_SCALES = (
    (170, 160, (36.5, 42.6), (49.4, 59.5)),
    (160, 150, (32.9, 37.6), (44.0, 52.5)),
    (0, 0, (29.1, 34.8), (38.5, 46.6)),
)


def fat_scale(sex: str | None, age: int | None) -> tuple[float, float, float, float] | None:
    """[very low, low, normal upper limit, high upper limit] body fat in %."""
    if sex not in (MALE, FEMALE) or age is None:
        return None
    for low, high, female, male in _FAT_SCALES:
        if low <= age < high:
            return female if sex == FEMALE else male
    return None


def muscle_scale(sex: str | None, height_cm: float | None) -> tuple[float, float] | None:
    """[low, normal upper limit] muscle mass in kg for the height."""
    if sex not in (MALE, FEMALE) or not height_cm:
        return None
    for min_male, min_female, female, male in _MUSCLE_SCALES:
        if height_cm >= (min_female if sex == FEMALE else min_male):
            return female if sex == FEMALE else male
    return None


def body_fat_class(body_fat: float | None, sex: str | None, age: int | None) -> str | None:
    """low / healthy / high / very_high, None without sex or for minors."""
    if body_fat is None or age is None or age < 18 or (scale := fat_scale(sex, age)) is None:
        return None
    if body_fat < scale[0]:
        return "low"
    if body_fat <= scale[2]:
        return "healthy"
    if body_fat <= scale[3]:
        return "high"
    return "very_high"


def body_fat_range(sex: str | None, age: int | None) -> tuple[float, float] | None:
    """Healthy body fat range (%) for display."""
    if age is None or age < 18 or (scale := fat_scale(sex, age)) is None:
        return None
    return scale[0], scale[2]


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


# ---------------------------------------------------------------- metrics

ACTIVITY_LEVELS = (1.2, 1.375, 1.55, 1.725, 1.9)  # physical activity level (PAL)
HEART_ZONES = {  # share of the heart rate reserve (Karvonen)
    "health": (0.5, 0.6), "fat_burn": (0.6, 0.7), "aerobic": (0.7, 0.8), "anaerobic": (0.8, 0.9),
}


def derived_metrics(
    *, weight: float | None, height_cm: float | None, age: int | None, sex: str | None,
    activity: float | None = None, heart_rate: float | None = None,
    impedance: float | None = None, lean_mass: float | None = None,
) -> dict[str, object]:
    """Indices, energy use and heart values that follow from the basic values.

    Everything that cannot be computed (missing height, age, pulse ...) is left out.
    """
    out: dict[str, object] = {}
    if not weight:
        return out
    known_sex = sex in (MALE, FEMALE)
    if height_cm:
        m = height_cm / 100
        out["ponderal_index"] = round(weight / m ** 3, 2)
        out["bsa"] = round(math.sqrt(height_cm * weight / 3600), 2)  # Mosteller
        if known_sex:
            out["broca_weight"] = round((height_cm - 100) * (0.9 if sex == MALE else 0.85), 1)
        if impedance:
            out["impedance_index"] = round(height_cm * height_cm / impedance, 2)
        if age and known_sex:
            mifflin = 10 * weight + 6.25 * height_cm - 5 * age + (5 if sex == MALE else -161)
            out["bmr_mifflin"] = round(mifflin)
            pal = activity if activity in ACTIVITY_LEVELS else ACTIVITY_LEVELS[0]
            out["activity"] = pal
            out["tdee"] = round(mifflin * pal)
    if lean_mass:
        out["bmr_katch"] = round(370 + 21.6 * lean_mass)  # Katch-McArdle
    if age:
        hr_max = 208 - 0.7 * age  # Tanaka
        out["hr_max"] = round(hr_max)
        if heart_rate and 30 <= heart_rate < hr_max:
            reserve = hr_max - heart_rate
            out["hr_reserve"] = round(reserve)
            out["zones"] = {
                key: [round(reserve * low + heart_rate), round(reserve * high + heart_rate)]
                for key, (low, high) in HEART_ZONES.items()
            }
            out["vo2max"] = round(15 * hr_max / heart_rate, 1)  # Uth et al.
    return out


# ---------------------------------------------------------------- analysis


def visceral_fat(weight: float, height_cm: float, age: int, sex: str) -> float:
    """Visceral fat rating (1-50), Zepp Life formula."""
    h, w = height_cm, weight
    if sex == MALE:
        if h < w * 1.6 + 63.0:
            value = age * 0.15 + ((w * 305.0) / ((h * 0.0826 * h - h * 0.4) + 48.0) - 2.9)
        else:
            value = age * 0.15 + (w * (h * -0.0015 + 0.765) - h * 0.143) - 5.0
    elif w <= h * 0.5 - 13.0:
        value = age * 0.07 + (w * (h * -0.0024 + 0.691) - h * 0.027) - 10.5
    else:
        value = age * 0.07 + ((w * 500.0) / ((h * 1.45 + h * 0.1158 * h) - 120.0) - 6.0)
    return _clamp(value, 1, 50)


def metabolic_age(weight: float, height_cm: float, age: int, sex: str, impedance: float) -> float:
    """Body (metabolic) age in years, Zepp Life formula."""
    if sex == MALE:
        value = height_cm * -0.7471 + weight * 0.9161 + age * 0.4184 + impedance * 0.0517 + 54.2267
    else:
        value = height_cm * -1.1165 + weight * 1.5784 + age * 0.4615 + impedance * 0.0415 + 83.2548
    return _clamp(value, 15, 80)


def skeletal_muscle_mass(height_cm: float, age: int, sex: str, impedance: float) -> float:
    """Skeletal muscle mass in kg (Janssen et al. 2000)."""
    value = (height_cm * height_cm / impedance) * 0.401 + (3.825 if sex == MALE else 0.0) - age * 0.071 + 5.102
    return max(0.0, value)


def ideal_weight(height_cm: float, sex: str) -> float:
    """Standard weight of the Xiaomi app."""
    return (height_cm - 70) * 0.6 if sex == FEMALE else (height_cm - 80) * 0.7


def expected_bone_mass(weight: float, sex: str) -> float:
    """Bone mass that counts as normal for the body weight."""
    table = ((75, 2.0), (60, 1.9), (0, 1.6)) if sex == MALE else ((60, 1.8), (45, 1.5), (0, 1.3))
    return next(bone for min_weight, bone in table if weight >= min_weight)


def normal_bmr(weight: float, age: int, sex: str) -> float:
    """Basal metabolic rate that counts as normal for weight and age."""
    table = ((30, 21.6), (50, 20.07), (200, 19.35)) if sex == MALE else ((30, 21.24), (50, 19.53), (200, 18.63))
    return weight * next(factor for max_age, factor in table if age < max_age)


BODY_TYPES = (
    "obese", "overweight", "thick_set",
    "lack_exercise", "balanced", "balanced_muscular",
    "skinny", "balanced_skinny", "skinny_muscular",
)


def body_type(fat: float, muscle: float, fats: tuple[float, ...], muscles: tuple[float, float]) -> str:
    """One of BODY_TYPES: rows by body fat (high, normal, low), columns by muscle (low, normal, high)."""
    fat_row = 0 if fat > fats[2] else 2 if fat < fats[1] else 1
    muscle_col = 2 if muscle > muscles[1] else 0 if muscle < muscles[0] else 1
    return BODY_TYPES[fat_row * 3 + muscle_col]


def _malus(value: float, value1: float, value2: float, malus1: float, malus2: float) -> float:
    """Penalty interpolated between two points, constant outside."""
    if value1 == value2:
        return 0.0
    if value2 < value1:
        value1, value2, malus1, malus2 = value2, value1, malus2, malus1
    if value <= value1:
        return malus1
    if value >= value2:
        return malus2
    return max(0.0, (malus2 - malus1) / (value2 - value1) * (value - value1) + malus1)


def _below(value: float, minimum: float, maximum: float) -> float:
    """Penalty for values below maximum (10 at minimum, 5 just below maximum)."""
    return 0.0 if value >= maximum else _malus(value, minimum, maximum, 10, 5)


def body_score(
    *, weight: float, bmi: float, age: int, sex: str, fat: float, muscle: float,
    water: float, visceral: float, bone: float, bmr: float, protein: float,
    fats: tuple[float, ...], muscles: tuple[float, float],
) -> int:
    """Body score 10-100: 100 minus penalties for values outside their range."""
    score = 100.0
    # BMI
    if bmi < 15:
        score -= _malus(bmi, 14, 15, 30, 15)
    elif bmi < 18.5:
        score -= 0 if fat < fats[2] and age < 18 else _malus(bmi, 15, 18.5, 15, 5)
    elif bmi >= 28 and fat >= fats[2]:
        score -= _malus(bmi, 28, 32, 5, 10)
    # body fat
    best = fats[2] - (3.0 if sex == MALE else 2.0)
    if fat < fats[0]:
        score -= _malus(fat, 1, fats[0], 10, 3)
    elif fat >= fats[2]:
        score -= _malus(fat, fats[2], fats[3], 10, 20)
    elif fat >= best:
        score -= _malus(fat, best, fats[2], 3, 9)
    score -= _below(muscle, muscles[0] - 5, muscles[0])
    normal_water = 55.0 if sex == MALE else 45.0
    score -= _below(water, normal_water - 5, normal_water)
    if visceral >= 10:
        score -= _malus(visceral, 10, 15, 10, 15)
    expected = expected_bone_mass(weight, sex)
    score -= _below(bone, expected - 0.3, expected)
    normal = normal_bmr(weight, age, sex)
    if bmr < normal:
        score -= _malus(bmr, normal - 300, normal, 6, 3)
    if protein <= 16:
        score -= _malus(protein, 10, 16, 10, 5)
    elif protein <= 17:
        score -= _malus(protein, 16, 17, 5, 3)
    return round(_clamp(score, 10, 100))


def analyze(
    weight: float, height_cm: float | None, age: int | None, sex: str | None,
    composition: Composition, impedance: float | None = None,
) -> dict[str, object]:
    """Extended analysis as in the Xiaomi app, from the composition of one reading.

    Values that cannot be computed (missing profile data or scale values) are
    left out. "status" rates each value: low / standard / good / high / very_high.
    """
    c = composition
    out: dict[str, object] = {}
    status: dict[str, str] = {}
    adult = age is not None and age >= 18
    known_sex = sex in (MALE, FEMALE)
    fats = fat_scale(sex, age)
    muscles = muscle_scale(sex, height_cm)

    if c.body_fat is not None:
        out["fat_mass"] = round(weight * c.body_fat / 100, 1)
        out["lean_mass"] = round(weight - weight * c.body_fat / 100, 1)
    if c.water is not None:
        out["water_mass"] = round(weight * c.water / 100, 1)
        if known_sex:
            normal_water = 55.0 if sex == MALE else 45.0
            status["water"] = "low" if c.water < normal_water else "good" if c.water <= normal_water + 10 else "high"
    if c.muscle_mass is not None:
        out["muscle_pct"] = round(c.muscle_mass / weight * 100, 1)
        if muscles:
            status["muscle_mass"] = status["muscle_pct"] = (
                "low" if c.muscle_mass < muscles[0] else "standard" if c.muscle_mass <= muscles[1] else "good"
            )
    if c.bone_mass is not None:
        out["bone_pct"] = round(c.bone_mass / weight * 100, 1)
        if known_sex:
            expected = expected_bone_mass(weight, sex)
            status["bone_mass"] = status["bone_pct"] = (
                "low" if c.bone_mass < expected - 0.3 else "good" if c.bone_mass > expected + 0.5 else "standard"
            )
    if c.muscle_mass is not None and c.water is not None:
        protein = _clamp(c.muscle_mass / weight * 100 - c.water, 5, 32)
        out["protein"] = round(protein, 1)
        out["protein_mass"] = round(weight * protein / 100, 1)
        status["protein"] = "low" if protein < 16 else "standard" if protein <= 20 else "good"
    if c.body_fat is not None and fats and adult:
        status["body_fat"] = (
            "low" if c.body_fat < fats[0] else "standard" if c.body_fat <= fats[2]
            else "high" if c.body_fat <= fats[3] else "very_high"
        )
    if c.bmr is not None and known_sex and age:
        status["bmr"] = "good" if c.bmr >= normal_bmr(weight, age, sex) else "low"

    if height_cm and age and known_sex:
        bmi = weight / (height_cm / 100) ** 2
        status["bmi"] = "low" if bmi < 18.5 else "standard" if bmi < 25 else "high" if bmi < 30 else "very_high"
        visceral = visceral_fat(weight, height_cm, age, sex)
        out["visceral_fat"] = round(visceral, 1)
        status["visceral_fat"] = "standard" if visceral < 10 else "high" if visceral < 15 else "very_high"
        ideal = ideal_weight(height_cm, sex)
        out["ideal_weight"] = round(ideal, 1)
        out["weight_control"] = round(ideal - weight, 1)
        if impedance and plausible_input(weight, height_cm, age, impedance):
            body_age = metabolic_age(weight, height_cm, age, sex, impedance)
            out["metabolic_age"] = round(body_age)
            status["metabolic_age"] = "good" if body_age < age - 0.5 else "standard" if body_age <= age + 0.5 else "high"
            out["skeletal_muscle"] = round(skeletal_muscle_mass(height_cm, age, sex, impedance), 1)
            if "muscle_mass" in status:
                status["skeletal_muscle"] = status["muscle_mass"]
        if c.body_fat is not None and fats:
            out["fat_control"] = round(weight * (fats[2] - c.body_fat) / 100, 1)
        if c.muscle_mass is not None and muscles:
            out["muscle_control"] = round(max(0.0, muscles[0] - c.muscle_mass), 1)
        if c.body_fat is not None and c.muscle_mass is not None and fats and muscles:
            out["body_type"] = body_type(c.body_fat, c.muscle_mass, fats, muscles)
        needed = (c.body_fat, c.muscle_mass, c.water, c.bone_mass, c.bmr, out.get("protein"))
        if adult and fats and muscles and all(v is not None for v in needed):
            out["body_score"] = body_score(
                weight=weight, bmi=bmi, age=age, sex=sex, fat=c.body_fat, muscle=c.muscle_mass,
                water=c.water, visceral=visceral, bone=c.bone_mass, bmr=c.bmr,
                protein=out["protein"], fats=fats, muscles=muscles,
            )
        segments = composition_segments(weight, sex, c, out.get("skeletal_muscle"))
        if segments:
            out["segments"] = segments
    out["status"] = status
    return out


# Essential fat in % of body weight (needed for life; ACE guidelines).
ESSENTIAL_FAT = {MALE: 3.0, FEMALE: 12.0}


def composition_segments(
    weight: float, sex: str | None, c: Composition, skeletal_muscle: float | None
) -> list[dict[str, object]] | None:
    """Body weight split into parts that add up to 100 % (for the body figure).

    muscle (skeletal muscle), essential fat, storage fat, bone and other
    (organs, blood, skin, water outside the muscles). Without the skeletal
    muscle estimate, "muscle" is the Xiaomi muscle mass and there is no "other".
    """
    if c.body_fat is None or c.bone_mass is None or sex not in ESSENTIAL_FAT:
        return None
    fat = weight * c.body_fat / 100
    essential = min(fat, weight * ESSENTIAL_FAT[sex] / 100)
    rest = max(0.0, weight - fat - c.bone_mass)
    if skeletal_muscle:
        muscle = min(skeletal_muscle, rest)
    elif c.muscle_mass is not None:
        muscle = min(c.muscle_mass, rest)
    else:
        return None
    parts = (
        ("muscle", muscle), ("essential_fat", essential), ("storage_fat", fat - essential),
        ("bone", c.bone_mass), ("other", rest - muscle),
    )
    return [
        {"key": key, "kg": round(kg, 1), "pct": round(kg / weight * 100, 1)}
        for key, kg in parts if kg > 0.05
    ]
