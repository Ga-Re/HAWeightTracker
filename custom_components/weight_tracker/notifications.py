"""Texts of the personal notifications (after weighing, milestones, reminders).

Pure Python without Home Assistant imports so it can be unit tested.
"""

from __future__ import annotations

from .milestones import KIND_CHANGE, KIND_COUNT, KIND_GOAL, KIND_STREAK, Milestone


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
    new_best: bool,
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
    if new_best:
        message += " 🎉 " + ("Neuer Bestwert!" if german else "New best!")
    return title, message


def milestone_message(german: bool, milestone: Milestone, goal_sign: int) -> tuple[str, str]:
    """Title and text for a newly reached milestone."""
    title = "🏆 " + ("Geschafft!" if german else "Milestone reached!")
    value = milestone.value
    if milestone.kind == KIND_CHANGE:
        amount = _num(abs(value), german, digits=1).rstrip("0").rstrip(",.")
        if german:
            text = f"Du hast {amount} kg {'zugenommen' if goal_sign > 0 else 'abgenommen'}."
        else:
            text = f"You have {'gained' if goal_sign > 0 else 'lost'} {amount} kg."
    elif milestone.kind == KIND_GOAL:
        text = (
            f"Zielgewicht {_num(value, german)} kg erreicht – herzlichen Glückwunsch!"
            if german
            else f"Goal weight {_num(value, german)} kg reached – congratulations!"
        )
    elif milestone.kind == KIND_STREAK:
        text = (
            f"{int(value)} Tage in Folge gewogen."
            if german
            else f"Weighed in {int(value)} days in a row."
        )
    elif milestone.kind == KIND_COUNT:
        text = f"{int(value)}. Messung." if german else f"{int(value)} measurements."
    else:
        text = milestone.id
    return title, text


def reminder_message(german: bool, days: int) -> tuple[str, str]:
    """Title and text of the "time to weigh in" reminder."""
    if german:
        return "⚖️ Zeit zum Wiegen", f"Deine letzte Messung ist {days} Tage her."
    return "⚖️ Time to weigh in", f"Your last measurement was {days} days ago."


def test_message(german: bool) -> tuple[str, str]:
    """Message of the test button."""
    if german:
        return "⚖️ Weight Tracker", "Benachrichtigungen funktionieren 👍"
    return "⚖️ Weight Tracker", "Notifications are working 👍"
