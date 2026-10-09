"""Texts of the personal notifications (after weighing, pet warnings, reminders).

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations



def _num(value: float, german: bool, digits: int = 1, signed: bool = False) -> str:
    text = f"{abs(value):.{digits}f}"
    if german:
        text = text.replace(".", ",")
    if signed:
        sign = "+" if value > 0.049 else "−" if value < -0.049 else "±"
        return f"{sign}{text}"
    return f"−{text}" if value < 0 else text


def weigh_message(
    german: bool,
    weight: float,
    change_last: float | None,
    trend: float | None,
    change_7d: float | None,
) -> tuple[str, str]:
    """Title and text sent to a person right after their measurement."""
    title = f"⚖️ {_num(weight, german)} kg"
    parts = []
    if change_last is not None:
        parts.append(
            f"{_num(change_last, german, signed=True)} kg seit der letzten Messung"
            if german
            else f"{_num(change_last, german, signed=True)} kg since last time"
        )
    if trend is not None:
        week = (
            f" ({_num(change_7d, german, signed=True)} kg in 7 Tagen)"
            if german and change_7d is not None
            else f" ({_num(change_7d, german, signed=True)} kg in 7 days)"
            if change_7d is not None
            else ""
        )
        parts.append(f"Trend {_num(trend, german)} kg{week}")
    message = " · ".join(parts) or ("Messung gespeichert." if german else "Measurement saved.")
    return title, message


def pet_warning_message(german: bool, name: str, code: str, percent: float, species: str) -> tuple[str, str]:
    """Title and text when a pet's weight changes unusually fast."""
    value = _num(percent, german, digits=1, signed=True)
    weekly = code.startswith("fast_")
    if german:
        period = "pro Woche" if weekly else "in 30 Tagen"
        what = "nimmt schnell ab" if percent < 0 else "nimmt schnell zu"
        hint = "Bei Katzen kann das ein frühes Warnzeichen sein – sprich am besten mit deiner Tierarztpraxis." if species == "cat" \
            else "Das kann ein Warnzeichen sein – sprich am besten mit deiner Tierarztpraxis."
        return f"⚠️ {name} {what}", f"{value} % {period}. {hint}"
    period = "per week" if weekly else "in 30 days"
    what = "is losing weight fast" if percent < 0 else "is gaining weight fast"
    hint = "In cats this can be an early warning sign – best talk to your vet." if species == "cat" \
        else "This can be a warning sign – best talk to your vet."
    return f"⚠️ {name} {what}", f"{value} % {period}. {hint}"


def reminder_message(german: bool, days: int) -> tuple[str, str]:
    """Title and text of the "time to weigh in" reminder."""
    if german:
        return "⚖️ Zeit zum Wiegen", f"Deine letzte Messung ist {days} Tage her."
    return "⚖️ Time to weigh in", f"Your last measurement was {days} days ago."


def clothes_question(german: bool) -> tuple[str, str, str]:
    """(question appended to the message, label "with", label "without")."""
    if german:
        return "Mit oder ohne Kleidung gewogen?", "👕 Mit Kleidung", "Ohne Kleidung"
    return "Weighed with or without clothes?", "👕 With clothes", "Without clothes"


def clothes_answer(german: bool, with_clothes: bool, counted: float, measured: float) -> tuple[str, str]:
    """Confirmation that replaces the question after a button was tapped."""
    title = f"⚖️ {_num(counted, german)} kg"
    if german:
        if with_clothes:
            return title, f"✓ Mit Kleidung gespeichert – gemessen {_num(measured, german)} kg, zählt als {_num(counted, german)} kg."
        return title, "✓ Ohne Kleidung gespeichert."
    if with_clothes:
        return title, f"✓ Saved with clothes – measured {_num(measured, german)} kg, counts as {_num(counted, german)} kg."
    return title, "✓ Saved without clothes."


def test_message(german: bool) -> tuple[str, str, str]:
    """(title, text, button label) of the test notification."""
    if german:
        return "⚖️ Weight Tracker", "Benachrichtigungen funktionieren 👍 Tippe zum Prüfen der Knöpfe auf „Knopf testen“ (iPhone: Nachricht lange drücken).", "✓ Knopf testen"
    return "⚖️ Weight Tracker", "Notifications are working 👍 Tap “Test button” to check the buttons (iPhone: long-press the notification).", "✓ Test button"


def test_answer(german: bool) -> tuple[str, str]:
    """Reply when the test button was tapped: the whole round trip works."""
    if german:
        return "⚖️ Weight Tracker", "✓ Knöpfe funktionieren – Home Assistant hat deine Antwort erhalten."
    return "⚖️ Weight Tracker", "✓ Buttons work – Home Assistant received your answer."
