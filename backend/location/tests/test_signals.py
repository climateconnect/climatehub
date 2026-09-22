from unittest.mock import patch

from django.test import TestCase

from location.models import Location
from location.tasks import fetch_and_create_location_translations


class LocationSignalsTest(TestCase):
    @patch.object(fetch_and_create_location_translations, "delay")
    def test_post_save_triggers_celery_task_on_create(self, mock_task_delay):
        self.assertEqual(mock_task_delay.call_count, 0)
        new_location = Location.objects.create(
            name="Test Location", osm_id=1234, osm_type="n"
        )
        self.assertEqual(mock_task_delay.call_count, 1)
        mock_task_delay.assert_called_once_with(new_location.pk)

    @patch.object(fetch_and_create_location_translations, "delay")
    def test_post_save_does_not_trigger_task_on_update(self, mock_task_delay):
        location = Location.objects.create(name="Initial Name")
        self.assertEqual(mock_task_delay.call_count, 1)

        mock_task_delay.reset_mock()

        location.name = "Updated Name"
        location.save()

        self.assertEqual(mock_task_delay.call_count, 0)
        mock_task_delay.assert_not_called()
