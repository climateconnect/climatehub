from typing import Optional, Union

from django.db.models import Sum

from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
    RegistrationStatus,
)
from organization.models.registration_field import (
    RegistrationFieldType,
)


def get_booked_seats(rc: EventRegistrationConfig) -> int:
    """Return the seats booked by active registrations of ``rc``.

    Single source of truth for capacity: every site that compares against
    ``max_participants`` must use this (or ``get_available_seats``) so that
    all numbers agree.  Cancelled registrations never hold seats.
    """
    return (
        EventRegistration.objects.filter(
            registration_config=rc,
            cancelled_at__isnull=True,
        ).aggregate(booked=Sum("number_of_seats"))["booked"]
        or 0
    )


def get_available_seats(rc: EventRegistrationConfig) -> Optional[int]:
    """Return seats left, or ``None`` for unlimited-capacity events."""
    if rc.max_participants is None:
        return None
    return max(0, rc.max_participants - get_booked_seats(rc))


def _is_option_sold_out(field, option):
    """Return True if a single option has zero remaining capacity."""
    if option.available_amount is None:
        return False

    active_answers = option.answers.filter(
        registration__cancelled_at__isnull=True,
    )
    if field.field_type == RegistrationFieldType.INVENTORY:
        booked = active_answers.aggregate(booked=Sum("value_number"))["booked"] or 0
    else:
        booked = active_answers.count()

    return option.available_amount - booked <= 0


def _are_required_fields_sold_out(rc: EventRegistrationConfig) -> bool:
    """True if any required capacity-limited field is fully sold out.

    A required field is sold out when every one of its options has zero
    remaining capacity.  Fields with no options or with unlimited options
    (available_amount=None) are never sold out.

    A guest must fill in every required field — if even one required field
    has no available options, registration is impossible.  So this is a
    per-field OR: returns True as soon as ANY required field is sold out.
    """
    required_fields = rc.fields.filter(
        field_type__in=[
            RegistrationFieldType.INVENTORY,
            RegistrationFieldType.TIME_SLOT_SELECT,
        ],
        is_required=True,
    ).prefetch_related("options")

    if not required_fields.exists():
        return False

    for field in required_fields:
        options = field.options.all()
        if not options.exists():
            continue

        field_sold_out = True
        for option in options:
            if not _is_option_sold_out(field, option):
                field_sold_out = False
                break

        if field_sold_out:
            return True

    return False


def evaluate_registration_status(
    rc: EventRegistrationConfig,
) -> Union[RegistrationStatus, str]:
    """Return the registration status the event should have right now.

    Considers max_participants, required-inventory availability, and
    required time-slot availability.

    Returns RegistrationStatus.FULL or RegistrationStatus.OPEN.

    Does NOT consider CLOSED or ENDED — those are set by other mechanisms
    (manual close, deadline) and are preserved by the caller.

    The caller is responsible for gating on auto-managed statuses: only
    apply the result when the current status is OPEN or FULL.
    """
    max_participants_full = False
    if rc.max_participants is not None:
        if get_booked_seats(rc) >= rc.max_participants:
            max_participants_full = True

    if max_participants_full:
        return RegistrationStatus.FULL

    if _are_required_fields_sold_out(rc):
        return RegistrationStatus.FULL

    return RegistrationStatus.OPEN
