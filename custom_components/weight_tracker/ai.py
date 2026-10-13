"""Prompt and answer parsing for AI hints (Home Assistant "AI Task").

Only numbers go to the AI: no name, no user, no dates of birth. Pure Python
without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from typing import Any

MAX_TIPS = 4
MAX_CHARS = 1200

_LABELS = {
    "de": {
        "sex": "Geschlecht", "male": "männlich", "female": "weiblich", "age": "Alter (Jahre)",
        "height": "Größe (cm)", "goal": "Zielgewicht (kg)", "weight": "Gewicht aktuell (kg)",
        "trend": "Trendgewicht, geglättet (kg)", "change_7d": "Veränderung 7 Tage (kg)",
        "change_30d": "Veränderung 30 Tage (kg)", "change_total": "Veränderung seit Beginn (kg)",
        "rate": "Tempo pro Woche (kg)", "bmi": "BMI", "body_fat": "Körperfett (%)",
        "muscle_mass": "Muskelmasse (kg)", "water": "Körperwasser (%)", "bone_mass": "Knochenmasse (kg)",
        "bmr": "Grundumsatz (kcal)", "protein": "Protein (%)", "visceral_fat": "Viszeralfett (Index)",
        "metabolic_age": "Körperalter (Jahre)", "skeletal_muscle": "Skelettmuskelmasse (kg)",
        "body_score": "Körperbewertung (Punkte von 100)", "body_type": "Körpertyp",
        "heart_rate": "Herzfrequenz (bpm)", "whtr": "Taille-zu-Größe-Verhältnis",
        "weekly": "Trendgewicht der letzten Wochen, älteste zuerst (kg)",
        "status": "Bewertung",
    },
    "en": {
        "sex": "Sex", "male": "male", "female": "female", "age": "Age (years)",
        "height": "Height (cm)", "goal": "Goal weight (kg)", "weight": "Current weight (kg)",
        "trend": "Trend weight, smoothed (kg)", "change_7d": "Change 7 days (kg)",
        "change_30d": "Change 30 days (kg)", "change_total": "Change since start (kg)",
        "rate": "Rate per week (kg)", "bmi": "BMI", "body_fat": "Body fat (%)",
        "muscle_mass": "Muscle mass (kg)", "water": "Body water (%)", "bone_mass": "Bone mass (kg)",
        "bmr": "Basal metabolic rate (kcal)", "protein": "Protein (%)", "visceral_fat": "Visceral fat (rating)",
        "metabolic_age": "Body age (years)", "skeletal_muscle": "Skeletal muscle mass (kg)",
        "body_score": "Body score (points of 100)", "body_type": "Body type",
        "heart_rate": "Heart rate (bpm)", "whtr": "Waist-to-height ratio",
        "weekly": "Trend weight of the last weeks, oldest first (kg)",
        "status": "rating",
    },
}

_INSTRUCTIONS = {
    "de": (
        "Du bist ein sachlicher, freundlicher Gesundheits- und Fitnesscoach. Werte die Messwerte "
        "einer Person von ihrer Körperanalysewaage aus. Körperfett, Muskeln, Wasser usw. sind "
        "Schätzungen aus der Impedanz und schwanken von Tag zu Tag; achte vor allem auf Trends.\n"
        "Antworte auf Deutsch, in Du-Form, ohne Überschriften und ohne Markdown-Formatierung:\n"
        "- Erste Zeile: eine Einschätzung in einem Satz (höchstens 25 Wörter).\n"
        "- Danach 2 bis 4 Zeilen, jede beginnt mit \"- \": konkrete, umsetzbare Empfehlungen "
        "(Ernährung, Bewegung, Schlaf, Trinken), je höchstens 25 Wörter.\n"
        "Stelle keine Diagnosen und empfiehl keine Medikamente oder Nahrungsergänzungsmittel. "
        "Bei deutlich auffälligen Werten empfiehl, das ärztlich abklären zu lassen. "
        "Nenne nur Zahlen, die in den Daten stehen.\n\nDaten:\n"
    ),
    "en": (
        "You are a factual, friendly health and fitness coach. Evaluate the measurements of a "
        "person from their body composition scale. Body fat, muscle, water etc. are estimates "
        "from impedance and vary from day to day; focus on trends.\n"
        "Answer in English, addressing the person directly, without headings or Markdown:\n"
        "- First line: an assessment in one sentence (at most 25 words).\n"
        "- Then 2 to 4 lines, each starting with \"- \": concrete, actionable recommendations "
        "(nutrition, exercise, sleep, drinking), at most 25 words each.\n"
        "Do not diagnose and do not recommend medication or supplements. If values are clearly "
        "abnormal, recommend having them checked by a doctor. Only quote numbers from the data.\n\nData:\n"
    ),
}


_WORDS = {
    "de": {
        "low": "niedrig", "standard": "normal", "good": "gut", "high": "hoch", "very_high": "sehr hoch",
        "excellent": "sehr gut", "guide": "Richtwert", "below": "unter dem Durchschnitt", "average": "durchschnittlich", "above": "über dem Durchschnitt",
        "obese": "fettleibig", "overweight": "übergewichtig", "athletic": "athletisch", "muscular": "muskulös",
        "fit": "fit", "lean_muscular": "schlank und muskulös", "lean": "schlank", "skinny_fat": "unsichtbar fettleibig (normales Gewicht, viel Fett)",
        "thin": "mager", "underweight": "untergewichtig",
    },
    "en": {
        "low": "low", "standard": "normal", "good": "good", "high": "high", "very_high": "very high",
        "excellent": "excellent", "guide": "guide value", "below": "below average", "average": "average", "above": "above average",
        "obese": "obese", "overweight": "overweight", "athletic": "athletic", "muscular": "muscular",
        "fit": "fit", "lean_muscular": "lean and muscular", "lean": "lean", "skinny_fat": "skinny fat (normal weight, high body fat)",
        "thin": "thin", "underweight": "underweight",
    },
}


def _fmt(value: Any) -> str:
    if isinstance(value, float):
        return f"{value:.2f}".rstrip("0").rstrip(".")
    return str(value)


def build_prompt(german: bool, facts: dict[str, Any]) -> str:
    """Instructions plus one "label: value" line per known fact.

    facts may hold the keys of _LABELS, "weekly" (list of kg) and "status"
    (key -> rating like "high"), which is appended to the matching line.
    """
    lang = "de" if german else "en"
    labels = _LABELS[lang]
    words = _WORDS[lang]
    status = facts.get("status") or {}
    lines = []
    for key, label in labels.items():
        if key in ("status", "male", "female") or facts.get(key) is None:
            continue
        value = facts[key]
        if key == "sex":
            value = labels.get(value, value)
        elif key == "body_type":
            value = words.get(value, value)
        elif key == "weekly":
            value = ", ".join(_fmt(v) for v in value)
        else:
            value = _fmt(value)
        rating = f" ({labels['status']}: {words.get(status[key], status[key])})" if key in status else ""
        lines.append(f"{label}: {value}{rating}")
    return _INSTRUCTIONS[lang] + "\n".join(lines)


def parse_answer(answer: Any) -> dict[str, Any]:
    """{"summary": str, "tips": [str]} from the AI's text answer."""
    text = answer if isinstance(answer, str) else str(answer or "")
    text = text.strip()[:MAX_CHARS]
    summary_parts: list[str] = []
    tips: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        numbered = line[:1].isdigit() and line[1:3] in (". ", ") ")
        bullet = numbered or line[:2] in ("- ", "• ", "* ", "– ")
        if bullet:
            line = line[3:] if numbered else line[2:]
        line = line.replace("**", "").strip()  # bold markers
        if bullet:
            tips.append(line)
        elif not tips:
            summary_parts.append(line)
        else:
            tips[-1] = f"{tips[-1]} {line}"
    return {"summary": " ".join(summary_parts).strip(), "tips": [t for t in tips if t][:MAX_TIPS]}
