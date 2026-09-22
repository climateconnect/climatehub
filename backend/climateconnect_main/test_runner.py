from django.db import connections
from django.test.runner import DiscoverRunner

from climateconnect_api.models import Language


class ClimateConnectTestRunner(DiscoverRunner):
    """Custom test runner that sets up required initial data for all tests."""

    def setup_databases(self, **kwargs):
        """Set up test databases and populate with required initial data."""
        result = super().setup_databases(**kwargs)

        self._seed_data()

        if self.parallel > 1:
            self._seed_parallel_clones()

        return result

    def _seed_data(self):
        """Create default languages referenced throughout the application."""
        Language.objects.get_or_create(
            language_code="en",
            defaults={
                "name": "English",
                "native_name": "English",
            },
        )
        Language.objects.get_or_create(
            language_code="de",
            defaults={
                "name": "German",
                "native_name": "Deutsch",
            },
        )

    def _seed_parallel_clones(self):
        """Seed Language rows into each parallel clone database.

        super().setup_databases() creates test DBs AND clones them before we
        seed data, so clone databases (used by worker processes) are missing
        the Language rows. Switch each clone into the default connection
        temporarily, insert the rows, then restore the original DB name.
        """
        for alias in connections:
            connection = connections[alias]
            original_name = connection.settings_dict["NAME"]
            for index in range(self.parallel):
                clone_name = f"{original_name}_{index + 1}"
                connection.settings_dict["NAME"] = clone_name
                connection.close()
                self._seed_data()
            connection.settings_dict["NAME"] = original_name
            connection.close()
