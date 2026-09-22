"""
Utility functions for working with feature toggles.

This module provides functions to check if a feature is enabled, with support for
caching to minimize database queries.
"""

import logging

from django.conf import settings
from django.core.cache import cache

from feature_toggles.models import FeatureToggle

logger = logging.getLogger(__name__)

# Cache key prefix for feature toggles
CACHE_KEY_PREFIX = "feature_toggle"

# Default cache timeout in seconds (5 minutes)
DEFAULT_CACHE_TIMEOUT = 300


def get_cache_key(feature_name: str, environment: str) -> str:
    """
    Generate a cache key for a feature toggle.

    Args:
        feature_name: The name of the feature toggle
        environment: The environment (production, staging, development)

    Returns:
        The cache key string
    """
    return f"{CACHE_KEY_PREFIX}_{environment}_{feature_name}"


def is_feature_enabled(
    feature_name: str, environment: str, default: bool = False
) -> bool:
    """
    Check if a feature is enabled for the given environment.

    This function uses caching to minimize database queries. Results are cached
    for 5 minutes by default.

    Args:
        feature_name: The name of the feature toggle (e.g., 'NEW_DASHBOARD')
        environment: The environment to check (e.g., 'production', 'staging', 'development')
        default: The default value to return if the toggle doesn't exist (default: False)

    Returns:
        True if the feature is enabled for the environment, False otherwise

    Raises:
        ValueError: If the environment is not valid
    """
    # Validate environment
    valid_environments = ["production", "staging", "development"]
    if environment not in valid_environments:
        logger.warning(
            f"Invalid environment '{environment}' provided to is_feature_enabled. "
            f"Must be one of {valid_environments}. Returning default: {default}"
        )
        return default

    # Generate cache key
    cache_key = get_cache_key(feature_name, environment)

    # Try to get from cache first
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        logger.debug(f"Cache hit for feature toggle: {cache_key}")
        return cached_value

    # Cache miss - query database
    logger.debug(f"Cache miss for feature toggle: {cache_key}, querying database")

    try:
        toggle = FeatureToggle.objects.get(name=feature_name)
        is_active = toggle.is_active_for_environment(environment)

        # Cache the result
        cache.set(cache_key, is_active, DEFAULT_CACHE_TIMEOUT)

        logger.debug(
            f"Feature toggle '{feature_name}' for environment '{environment}' "
            f"is {'enabled' if is_active else 'disabled'}"
        )

        return is_active

    except FeatureToggle.DoesNotExist:
        # Feature toggle doesn't exist - return default and don't cache
        logger.debug(
            f"Feature toggle '{feature_name}' does not exist. Returning default: {default}"
        )
        return default

    except Exception as e:
        # Unexpected error - log and return default
        logger.error(
            f"Error checking feature toggle '{feature_name}': {str(e)}. "
            f"Returning default: {default}"
        )
        return default


def is_feature_enabled_for_current_environment(
    feature_name: str, default: bool = False
) -> bool:
    """
    Check a feature toggle from backend code, without the caller having to work
    out which environment it is running in.

    Most toggles are read by the frontend, which detects its environment from
    the request host. Backend code has no request to look at, so it uses
    ``settings.FEATURE_TOGGLE_ENVIRONMENT`` — see the comment on that setting
    for why it is not simply ``ENVIRONMENT``.

    Args:
        feature_name: The name of the feature toggle (e.g. 'LOCATIONIQ_AUTOCOMPLETE')
        default: Value to return if the toggle doesn't exist or can't be read

    Returns:
        True if the feature is enabled for this backend's environment.
    """
    return is_feature_enabled(
        feature_name, settings.FEATURE_TOGGLE_ENVIRONMENT, default
    )


def get_all_toggles_for_environment(environment: str) -> dict:
    """
    Get all feature toggles for a given environment.

    This function returns a dictionary with toggle names as keys and their
    active state as values. Results are cached.

    Args:
        environment: The environment to get toggles for (e.g., 'production')

    Returns:
        Dictionary with toggle names as keys and boolean states as values

    Raises:
        ValueError: If the environment is not valid
    """
    # Validate environment
    valid_environments = ["production", "staging", "development"]
    if environment not in valid_environments:
        logger.warning(
            f"Invalid environment '{environment}' provided to get_all_toggles_for_environment. "
            f"Must be one of {valid_environments}. Returning empty dict."
        )
        return {}

    # Generate cache key for all toggles
    cache_key = f"{CACHE_KEY_PREFIX}_all_{environment}"

    # Try to get from cache first
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        logger.debug(f"Cache hit for all feature toggles: {cache_key}")
        return cached_value

    # Cache miss - query database
    logger.debug(f"Cache miss for all feature toggles: {cache_key}, querying database")

    try:
        toggles = FeatureToggle.objects.all()
        result = {}

        for toggle in toggles:
            result[toggle.name] = toggle.is_active_for_environment(environment)

        # Cache the result
        cache.set(cache_key, result, DEFAULT_CACHE_TIMEOUT)

        logger.debug(
            f"Retrieved {len(result)} feature toggles for environment '{environment}'"
        )

        return result

    except Exception as e:
        logger.error(
            f"Error getting all feature toggles for environment '{environment}': {str(e)}"
        )
        return {}


def invalidate_all_feature_toggle_caches():
    """
    Invalidate all feature toggle caches.

    This deletes both individual feature caches and all_{environment} caches
    for all environments (production, staging, development).
    """
    # First, delete all_{environment} caches
    for env in ["production", "staging", "development"]:
        cache_key = f"{CACHE_KEY_PREFIX}_all_{env}"
        cache.delete(cache_key)
    # Then delete all individual feature caches
    # We need to query the database to get all toggle names
    try:
        toggles = FeatureToggle.objects.values_list("name", flat=True)
        for toggle_name in toggles:
            for env in ["production", "staging", "development"]:
                cache_key = get_cache_key(toggle_name, env)
                cache.delete(cache_key)
    except Exception as e:
        logger.warning(
            f"Could not query feature toggles to invalidate individual caches: {e}"
        )
    logger.debug(f"Invalidated all feature toggle caches")
