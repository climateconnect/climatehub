import os
import shutil
import tempfile

from django.db import connections
from django.test.runner import DiscoverRunner
from django.test.utils import override_settings

from climateconnect_api.models import Language


class ClimateConnectTestRunner(DiscoverRunner):
    """Custom test runner that sets up required initial data for all tests."""

    def setup_test_environment(self, **kwargs):
        """Point ``MEDIA_ROOT`` at a throwaway directory for the whole run.

        ``MEDIA_ROOT`` comes from the environment and points at the developer's
        real media directory, and test databases hand out primary keys that
        collide with real rows — so without this, any test that uploads an
        image drops files into e.g. ``media/projects/34/`` next to real ones.
        Doing it here covers every test, including ones written later.
        """
        super().setup_test_environment(**kwargs)
        self._media_root = tempfile.mkdtemp(prefix="cc-test-media-")
        # Parallel workers started with "spawn" (macOS) re-import settings
        # instead of inheriting this process's overrides, so set the env var
        # that settings.py reads as well.
        self._original_media_root_env = os.environ.get("MEDIA_ROOT")
        os.environ["MEDIA_ROOT"] = self._media_root
        self._media_override = override_settings(MEDIA_ROOT=self._media_root)
        self._media_override.enable()

    def teardown_test_environment(self, **kwargs):
        self._media_override.disable()
        if self._original_media_root_env is None:
            os.environ.pop("MEDIA_ROOT", None)
        else:
            os.environ["MEDIA_ROOT"] = self._original_media_root_env
        shutil.rmtree(self._media_root, ignore_errors=True)
        super().teardown_test_environment(**kwargs)

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
