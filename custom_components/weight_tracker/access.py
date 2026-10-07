"""Who may see and change which person's data.

- Admins (and internal calls without a user, e.g. automations) may do everything.
- The Home Assistant user linked to a person sees and manages that person's data.
- Users listed as viewers of a person may only see it.
- Everybody else sees nothing of that person.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

from .const import CONF_USER_ID, CONF_VIEWERS

if TYPE_CHECKING:
    from homeassistant.auth.models import User
    from homeassistant.core import HomeAssistant


class UserLike(Protocol):
    """The parts of homeassistant.auth.models.User used here."""

    id: str
    is_admin: bool


def is_unrestricted(user: UserLike | None) -> bool:
    """Admins and internal calls are not restricted."""
    return user is None or user.is_admin


def can_view(user: UserLike | None, person: dict[str, Any]) -> bool:
    """Return True if the user may see the person's data."""
    if is_unrestricted(user):
        return True
    assert user is not None
    return user.id == person.get(CONF_USER_ID) or user.id in person.get(CONF_VIEWERS, [])


def can_manage(user: UserLike | None, person: dict[str, Any]) -> bool:
    """Return True if the user may change the person's measurements."""
    if is_unrestricted(user):
        return True
    assert user is not None
    return user.id == person.get(CONF_USER_ID)


async def async_assignable_users(hass: HomeAssistant) -> list[User]:
    """Real (non system) users that can be linked to persons."""
    users = await hass.auth.async_get_users()
    return sorted(
        (u for u in users if not u.system_generated and u.is_active),
        key=lambda u: (u.name or "").casefold(),
    )
