from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.contrib.gis.geos import MultiPolygon, Point, Polygon
from django.test import TestCase, override_settings, tag
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from auth_app.models import LoginAuditLog
from climateconnect_api.models import Language, UserProfile
from hubs.models import Hub
from location.models import Location, LocationTranslation

# from climateconnect_api.factories import UserFactory


# class TestUserLoginView(APITestCase):
#     def setUp(self):
#         self.user = UserFactory(username="test_user", password="testing2020")

#     def test_successful_login_api(self):
#         url = reverse("login-api")
#         data = {"username": "test_user", "password": "testing@2020"}
#         response = self.client.post(url, data, format="json")
#         self.assertEqual(response.status_code, status.HTTP_200_OK)

#     def test_failed_login_api(self):
#         url = reverse("login-api")
#         data = {"username": "test", "password": "testing2020"}
#         response = self.client.post(url, data, format="json")
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

#     def test_missing_password(self):
#         url = reverse("login-api")
#         data = {"username": "test_user"}
#         response = self.client.post(url, data, format="json")
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# class TestSignUpView(APITestCase):
#     def test_signup_api_success(self):
#         url = reverse("signup-api")

#         data = {
#             "email": "test@testovich.com",
#             "password": "testing@2020",
#             "first_name": "Climate",
#             "last_name": "Tester",
#             "country": "Germany",
#             "state": "Berlin",
#             "City": "Berlin",
#         }

#         response = self.client.post(url, data, format="json")
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)

#     def test_signup_missing_parameter(self):
#         url = reverse("signup-api")
#         data = {
#             "email": "test@testovich.com",
#             "password": "testing@2020",
#             "last_name": "Tester",
#         }

#         response = self.client.post(url, data, format="json")
#         self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


def _create_verified_member(username, location, url_slug):
    """Helper: create a verified UserProfile with a given location."""
    user = User.objects.create_user(username=username, password="testpassword")
    return UserProfile.objects.create(
        user=user,
        location=location,
        url_slug=url_slug,
        name=username,
        is_profile_verified=True,
    )


class MemberProfileLocaleTest(TestCase):
    def setUp(self):
        self.url = reverse(
            "get-member-profile-api",
            kwargs={"url_slug": "translated-member"},
        )
        self.language_de = Language.objects.get(language_code="de")
        self.location = Location.objects.create(
            name="Munich",
            city="Munich",
            country="Germany",
        )
        LocationTranslation.objects.create(
            location=self.location,
            language=self.language_de,
            name_translation="München",
        )
        self.profile = _create_verified_member(
            "translated_member",
            self.location,
            "translated-member",
        )

    @tag("members", "location")
    def test_member_profile_returns_translated_location_name(self):
        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["location"], "München")

    @tag("members", "location")
    def test_member_profile_falls_back_to_english_location_name(self):
        self.profile.location = Location.objects.create(
            name="Cologne",
            city="Cologne",
            country="Germany",
        )
        self.profile.save()

        response = self.client.get(self.url, HTTP_ACCEPT_LANGUAGE="de")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["location"], "Cologne")


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}
)
class MemberLocationHubFilterTest(TestCase):
    """
    Test case for filtering members by location hubs.
    Tests the code in user_views.py that handles filtering member profiles
    by location hubs with aggregated geometry.
    """

    def setUp(self):
        """
        Set up test data for each test method.

        Test data structure:
        - 1 Hub "Erlangen" with 3 locations: Erlangen, Bubenreuth, Spardorf
        - 10 UserProfiles total:
          - 3 with exact hub locations (Erlangen, Bubenreuth, Spardorf)
          - 3 with addresses in Erlangen, Bubenreuth, Spardorf
          - 2 in Nurnberg (location + address) - negative test cases
          - 2 in Paris (location + address) - negative test cases
        """
        # The post_save signal on UserProfile calls cache.keys() which is a
        # django-redis extension not present on DummyCache. Patch it directly.
        self._cache_patcher = patch("climateconnect_api.models.user.cache", MagicMock())
        self._cache_patcher.start()

        self.url = reverse("member-profiles-api")

        # ===== Hub Locations (3 locations for Erlangen Hub) =====
        self.location_erlangen = Location.objects.create(
            name="Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0050, 49.5975),
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (10.95, 49.55),
                        (11.06, 49.55),
                        (11.06, 49.64),
                        (10.95, 49.64),
                        (10.95, 49.55),
                    )
                )
            ),
        )

        self.location_bubenreuth = Location.objects.create(
            name="Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0200, 49.6300),
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (11.00, 49.62),
                        (11.04, 49.62),
                        (11.04, 49.64),
                        (11.00, 49.64),
                        (11.00, 49.62),
                    )
                )
            ),
        )

        self.location_spardorf = Location.objects.create(
            name="Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0600, 49.5900),
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (11.05, 49.58),
                        (11.07, 49.58),
                        (11.07, 49.60),
                        (11.05, 49.60),
                        (11.05, 49.58),
                    )
                )
            ),
        )

        # ===== Hub for Erlangen with 3 locations =====
        self.hub_erlangen = Hub.objects.create(
            name="Erlangen Hub",
            url_slug="erlangen-hub",
            hub_type=Hub.LOCATION_HUB_TYPE,
            image="/media/hub_images/default.jpg",
        )
        self.hub_erlangen.location.add(self.location_erlangen)
        self.hub_erlangen.location.add(self.location_bubenreuth)
        self.hub_erlangen.location.add(self.location_spardorf)

        # ===== Address Locations within hub area =====
        self.location_erlangen_address = Location.objects.create(
            name="Goethestraße 1, Erlangen, Germany",
            city="Erlangen",
            country="Germany",
            centre_point=Point(11.0020, 49.5985),
            multi_polygon=None,
        )

        self.location_bubenreuth_address = Location.objects.create(
            name="Bussardstraße 21, Bubenreuth, Germany",
            city="Bubenreuth",
            country="Germany",
            centre_point=Point(11.0210, 49.6310),
            multi_polygon=None,
        )

        self.location_spardorf_address = Location.objects.create(
            name="Eisenstraße, Spardorf, Germany",
            city="Spardorf",
            country="Germany",
            centre_point=Point(11.0610, 49.5910),
            multi_polygon=None,
        )

        # ===== Negative Test Locations (Nuremberg & Paris) =====
        self.location_nuremberg = Location.objects.create(
            name="Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0767, 49.4521),
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (10.95, 49.40),
                        (11.20, 49.40),
                        (11.20, 49.50),
                        (10.95, 49.50),
                        (10.95, 49.40),
                    )
                )
            ),
        )

        self.location_nuremberg_address = Location.objects.create(
            name="Plobenhofstraße 1, Nuremberg, Germany",
            city="Nuremberg",
            country="Germany",
            centre_point=Point(11.0780, 49.4530),
            multi_polygon=None,
        )

        self.location_paris = Location.objects.create(
            name="Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3522, 48.8566),
            multi_polygon=MultiPolygon(
                Polygon(
                    (
                        (2.20, 48.80),
                        (2.50, 48.80),
                        (2.50, 49.00),
                        (2.20, 49.00),
                        (2.20, 48.80),
                    )
                )
            ),
        )

        self.location_paris_address = Location.objects.create(
            name="Hotel de Ville, Paris, France",
            city="Paris",
            country="France",
            centre_point=Point(2.3530, 48.8570),
            multi_polygon=None,
        )

        # ===== Create 10 UserProfiles =====
        self.member_erlangen_location = _create_verified_member(
            "member_erlangen_location",
            self.location_erlangen,
            "member-erlangen-location",
        )
        self.member_bubenreuth_location = _create_verified_member(
            "member_bubenreuth_location",
            self.location_bubenreuth,
            "member-bubenreuth-location",
        )
        self.member_spardorf_location = _create_verified_member(
            "member_spardorf_location",
            self.location_spardorf,
            "member-spardorf-location",
        )

        self.member_erlangen_address = _create_verified_member(
            "member_erlangen_address",
            self.location_erlangen_address,
            "member-erlangen-address",
        )
        self.member_bubenreuth_address = _create_verified_member(
            "member_bubenreuth_address",
            self.location_bubenreuth_address,
            "member-bubenreuth-address",
        )
        self.member_spardorf_address = _create_verified_member(
            "member_spardorf_address",
            self.location_spardorf_address,
            "member-spardorf-address",
        )

        # Negative test members - Nuremberg
        self.member_nuremberg_location = _create_verified_member(
            "member_nuremberg_location",
            self.location_nuremberg,
            "member-nuremberg-location",
        )
        self.member_nuremberg_address = _create_verified_member(
            "member_nuremberg_address",
            self.location_nuremberg_address,
            "member-nuremberg-address",
        )

        # Negative test members - Paris
        self.member_paris_location = _create_verified_member(
            "member_paris_location",
            self.location_paris,
            "member-paris-location",
        )
        self.member_paris_address = _create_verified_member(
            "member_paris_address",
            self.location_paris_address,
            "member-paris-address",
        )

    def tearDown(self):
        self._cache_patcher.stop()

    def _get_url_slugs(self, response):
        return [m["url_slug"] for m in response.json().get("results", [])]

    @tag("location_hub", "members")
    def test_filter_members_by_multi_location_hub(self):
        """
        Test filtering members by the Erlangen hub with 3 locations.
        Should return all 6 members within Erlangen, Bubenreuth, and Spardorf.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)

        self.assertIn("member-erlangen-location", slugs)
        self.assertIn("member-bubenreuth-location", slugs)
        self.assertIn("member-spardorf-location", slugs)
        self.assertIn("member-erlangen-address", slugs)
        self.assertIn("member-bubenreuth-address", slugs)
        self.assertIn("member-spardorf-address", slugs)

        self.assertEqual(len(slugs), 6)

        self.assertNotIn("member-nuremberg-location", slugs)
        self.assertNotIn("member-nuremberg-address", slugs)
        self.assertNotIn("member-paris-location", slugs)
        self.assertNotIn("member-paris-address", slugs)

    @tag("location_hub", "members")
    def test_aggregated_geometry_with_multiple_hub_locations(self):
        """
        Test the aggregated geometry functionality (Union of geometries).
        Verifies that members within any of the 3 hub locations are returned.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)

        self.assertIn("member-erlangen-location", slugs)
        self.assertIn("member-bubenreuth-location", slugs)
        self.assertIn("member-spardorf-location", slugs)

        self.assertIn("member-erlangen-address", slugs)
        self.assertIn("member-bubenreuth-address", slugs)
        self.assertIn("member-spardorf-address", slugs)

    @tag("location_hub", "members")
    def test_filter_members_by_hub_filters_by_country(self):
        """
        Test that location hub filtering correctly filters by country first.
        Paris members should not appear.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)

        for slug in slugs:
            profile = UserProfile.objects.get(url_slug=slug)
            self.assertEqual(profile.location.country, "Germany")

        self.assertNotIn("member-paris-location", slugs)
        self.assertNotIn("member-paris-address", slugs)

    @tag("location_hub", "members")
    def test_filter_excludes_members_outside_hub_geometry(self):
        """
        Test that members outside the hub's geometry are excluded.
        Nuremberg members should not be included even though they're in Germany.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)

        self.assertNotIn("member-nuremberg-location", slugs)
        self.assertNotIn("member-nuremberg-address", slugs)

        self.assertEqual(len(slugs), 6)

    @tag("location_hub", "members")
    def test_filter_members_by_nonexistent_hub(self):
        """
        Test filtering by a hub that doesn't exist.
        Should return no results.
        """
        response = self.client.get(self.url, {"hub": "nonexistent-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

    @tag("location_hub", "members")
    def test_filter_members_without_hub_parameter(self):
        """
        Test that without hub parameter, all verified members are returned.
        Should return all 10 members created in setUp.
        """
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)
        expected = [
            "member-erlangen-location",
            "member-bubenreuth-location",
            "member-spardorf-location",
            "member-erlangen-address",
            "member-bubenreuth-address",
            "member-spardorf-address",
            "member-nuremberg-location",
            "member-nuremberg-address",
            "member-paris-location",
            "member-paris-address",
        ]
        for slug in expected:
            self.assertIn(slug, slugs)

    @tag("location_hub", "members")
    def test_address_locations_within_hub_geometry(self):
        """
        Test that address-based locations (null multi_polygon) are correctly matched
        via their centre_point falling within the aggregated hub geometry.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = self._get_url_slugs(response)

        self.assertIn("member-erlangen-address", slugs)
        self.assertIn("member-bubenreuth-address", slugs)
        self.assertIn("member-spardorf-address", slugs)

        for slug in [
            "member-erlangen-address",
            "member-bubenreuth-address",
            "member-spardorf-address",
        ]:
            profile = UserProfile.objects.get(url_slug=slug)
            self.assertIsNone(profile.location.multi_polygon)

    @tag("location_hub", "members")
    def test_distinct_results_when_multiple_filters_match(self):
        """
        Test that results are distinct even when a member matches multiple filter criteria.
        """
        response = self.client.get(self.url, {"hub": "erlangen-hub"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])

        slugs = [m["url_slug"] for m in results]
        self.assertEqual(
            len(slugs),
            len(set(slugs)),
            "Results should be distinct (no duplicates)",
        )

        self.assertEqual(len(slugs), 6)


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}
)
class TestListMemberProfilesAPIViewPost(APITestCase):
    """
    Regression tests for POST location-body search on the members list endpoint.

    The frontend sends the location object in the POST body. The endpoint must
    accept POST (not 405) and route it through the existing location filter.
    """

    def setUp(self):
        self._cache_patcher = patch("climateconnect_api.models.user.cache", MagicMock())
        self._cache_patcher.start()
        self.addCleanup(self._cache_patcher.stop)
        self.url = reverse("member-profiles-api")
        self.location = Location.objects.create(name="Munich", country="Germany")
        for i in range(3):
            _create_verified_member(f"member_{i}", self.location, f"member-{i}")

    @tag("members")
    def test_post_with_location_body_returns_200(self):
        location_body = {
            "place_id": "abc123",
            "geojson": {"type": "Point", "coordinates": [11.0, 49.0]},
            "osm_id": 123,
            "osm_type": "node",
            "lat": 49.0,
            "lon": 11.0,
        }
        with patch(
            "climateconnect_api.views.user_views.get_location_with_range"
        ) as mock_loc:
            from django.contrib.gis.geos import Point

            mock_loc.return_value = {
                "location": Point(11.0, 49.0),
                "radius": 0,
                "country": "Germany",
            }
            response = self.client.post(self.url, location_body, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 3)

    @tag("members")
    def test_post_without_location_body_returns_200(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 3)


_counter_login = 0


def _make_user_for_login(email, verified=True, password="testpassword"):
    global _counter_login
    _counter_login += 1
    user = User.objects.create_user(username=email, email=email, password=password)
    UserProfile.objects.create(
        user=user,
        url_slug="login-slug-{}".format(_counter_login),
        is_profile_verified=verified,
    )
    return user


class LoginViewAuditLogTest(TestCase):
    """
    Test that POST /login/ writes a LoginAuditLog entry on every attempt.
    """

    def setUp(self):
        LoginAuditLog.objects.all().delete()
        self.url = reverse("login-api")

    def test_successful_login_writes_verified_audit_log(self):
        user = _make_user_for_login("ok@example.com")
        resp = self.client.post(
            self.url,
            {"username": "ok@example.com", "password": "testpassword"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(LoginAuditLog.objects.count(), 1)
        log = LoginAuditLog.objects.first()
        self.assertEqual(log.email, "ok@example.com")
        self.assertEqual(log.user, user)
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.VERIFIED)

    def test_wrong_password_writes_failed_audit_log_with_user(self):
        user = _make_user_for_login("wrong@example.com")
        resp = self.client.post(
            self.url,
            {"username": "wrong@example.com", "password": "badpassword"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(LoginAuditLog.objects.count(), 1)
        log = LoginAuditLog.objects.first()
        self.assertEqual(log.email, "wrong@example.com")
        self.assertEqual(log.user, user)
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.FAILED)

    def test_unknown_email_writes_failed_audit_log_with_no_user(self):
        resp = self.client.post(
            self.url,
            {"username": "unknown@example.com", "password": "anypassword"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(LoginAuditLog.objects.count(), 1)
        log = LoginAuditLog.objects.first()
        self.assertEqual(log.email, "unknown@example.com")
        self.assertIsNone(log.user)
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.FAILED)

    def test_unverified_account_writes_failed_audit_log(self):
        user = _make_user_for_login("unverified@example.com", verified=False)
        resp = self.client.post(
            self.url,
            {"username": "unverified@example.com", "password": "testpassword"},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        data = resp.json()
        self.assertEqual(data.get("type"), "not_verified")
        self.assertEqual(LoginAuditLog.objects.count(), 1)
        log = LoginAuditLog.objects.first()
        self.assertEqual(log.email, "unverified@example.com")
        self.assertEqual(log.user, user)
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.FAILED)
