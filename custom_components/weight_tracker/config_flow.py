"""Config flow for Weight Tracker.

Only the scale sensor is chosen here. Persons, detection settings and access
rights are managed in the "Weight" sidebar panel (tab "Settings").
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components.sensor import DOMAIN as SENSOR_DOMAIN
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    TextSelector,
)

from .const import CONF_PERSONS, CONF_SOURCE, DEFAULT_NAME, DOMAIN
from .settings import SETTING_DEFAULTS

USER_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME, default=DEFAULT_NAME): TextSelector(),
        vol.Required(CONF_SOURCE): EntitySelector(EntitySelectorConfig(domain=SENSOR_DOMAIN)),
    }
)


class WeightTrackerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Add a scale."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """Settings live in the panel; the options flow only points there."""
        return WeightTrackerOptionsFlow()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Choose the scale sensor."""
        if user_input is not None:
            self._async_abort_entries_match({CONF_SOURCE: user_input[CONF_SOURCE]})
            return self.async_create_entry(
                title=user_input[CONF_NAME].strip() or DEFAULT_NAME,
                data={},
                options={
                    CONF_SOURCE: user_input[CONF_SOURCE],
                    **SETTING_DEFAULTS,
                    CONF_PERSONS: [],
                },
            )
        return self.async_show_form(step_id="user", data_schema=USER_SCHEMA)


class WeightTrackerOptionsFlow(OptionsFlow):
    """Point to the panel."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Explain where the settings are."""
        return self.async_abort(reason="use_panel")
