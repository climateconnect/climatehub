from django.urls import path

from location import location_views

app_name = "location"
urlpatterns = [
    # Location URLs
    path(
        "get_location/", location_views.GetLocationView.as_view(), name="get-location"
    ),
    # LocationIQ-backed autocomplete with Nominatim fallback
    path(
        "location_autocomplete/",
        location_views.LocationAutocompleteView.as_view(),
        name="location-autocomplete",
    ),
    # Autocomplete request tracking. Both providers are counted here, hence the
    # provider-neutral names.
    path(
        "autocomplete_request_count/",
        location_views.TrackAutocompleteRequestView.as_view(),
        name="track-autocomplete-request",
    ),
    path(
        "autocomplete_stats/",
        location_views.AutocompleteStatsView.as_view(),
        name="autocomplete-stats",
    ),
    # Deprecated aliases for the two paths above, kept because a browser
    # running a cached JS bundle from before this rename still POSTs to
    # /api/nominatim_request_count/ after the backend deploys. That call is the
    # *toggle-off* tracking path — the one carrying production traffic today —
    # and it is fire-and-forget, so a 404 would silently under-report exactly
    # the baseline this migration is measured against. Safe to delete once no
    # stale bundles are in circulation (a few days after the frontend deploy).
    path(
        "nominatim_request_count/",
        location_views.TrackAutocompleteRequestView.as_view(),
        name="track-nominatim-request",
    ),
    path(
        "nominatim_stats/",
        location_views.AutocompleteStatsView.as_view(),
        name="nominatim-stats",
    ),
]
