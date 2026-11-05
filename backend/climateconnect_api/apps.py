from django.apps import AppConfig


class ClimateconnectApiConfig(AppConfig):
    name = "climateconnect_api"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        """Import signals when app is ready."""
        import climateconnect_api.signals  # noqa
