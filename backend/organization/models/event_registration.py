from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from django.db import models

from organization.models.project import Project


class RegistrationStatus(models.TextChoices):
    """
    Explicit lifecycle states for event registration.

    OPEN   — registration is accepting sign-ups (default).
    CLOSED — organiser has manually closed registration ahead of the end date.
    FULL   — the system sets this when max_participants is reached; new sign-ups
             are blocked.  Set in the same DB transaction as the last accepted
             registration (using select_for_update + atomic counter) to avoid
             races.  Automatically transitions back to OPEN if a participant
             cancels and the count drops below max_participants.
    ENDED  — ⚠️  PYTHON-SIDE ONLY — NEVER WRITTEN TO THE DATABASE.
             Computed lazily by the serializer when ``stored_status == OPEN``
             and ``registration_end_date <= now()``.  Allows API consumers to
             distinguish a naturally-expired registration from an
             organiser-closed one without a Celery Beat job or schema change.
             ``validate_status()`` rejects this value on write, so it can never
             be stored.

    The effective "is registration accepting?" check in the application layer is:
        effective_status == OPEN
    which combines the stored status and the deadline check into one value.
    A separate FULL state (vs. a computed count query) keeps this check O(1)
    without a COUNT(*) on every incoming signup request.

    Edge case — organiser changes max_participants via PATCH:
        • new max > current signup count AND status == FULL  → set status = OPEN
          (capacity has been raised; registration is no longer full)
        • new max < current signup count AND status == OPEN  → set status = FULL
          (capacity has been lowered below existing signups; block new registrations)
        • new max == current signup count AND status == OPEN → set status = FULL
        Both transitions must happen atomically in the same DB transaction as the
        EventRegistrationConfig.save() call, using select_for_update() on the
        registration count aggregate to avoid races.
        ⚠️  This logic is deferred until the Registrations feature (signup table)
        is built.  See the PATCH handler in project_views.py for the TODO marker.
    """

    OPEN = "open", "Open"
    CLOSED = "closed", "Closed"
    FULL = "full", "Full"
    ENDED = "ended", "Ended"  # Python-side only — never stored in the DB.


class EventRegistrationConfig(models.Model):
    """
    Stores registration settings for an event project.

    The presence of this record is the source of truth for whether online
    registration is enabled for the associated event — no separate boolean
    flag on Project is needed.

    Timezone handling: registration_end_date is a timezone-aware DateTimeField
    (TIMESTAMPTZ in PostgreSQL), consistent with Project.start_date / end_date.
    USE_TZ=True means all datetimes are stored in UTC. The API accepts ISO 8601
    strings (e.g. "2026-06-01T23:59:00Z"); the browser timezone is used in the
    UI but the backend always stores/compares in UTC.
    """

    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name="registration_config",
        help_text="The event project this registration configuration belongs to",
        verbose_name="Project",
    )

    max_participants = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Maximum number of participants allowed to register (must be > 0). "
            "May be null while the project is still a draft."
        ),
        verbose_name="Maximum Participants",
    )

    max_seats_per_registration = models.PositiveIntegerField(
        default=1,
        db_default=1,
        validators=[MinValueValidator(1)],
        help_text=(
            "Maximum number of seats one registration may book (the registrant "
            "plus their guests). Default 1 = one seat per registration. "
            "No platform-wide cap beyond max_participants."
        ),
        verbose_name="Max. Seats per Registration",
    )

    registration_end_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Date and time when registration closes. "
            "Timezone-aware (TIMESTAMPTZ), stored in UTC. "
            "Must be on or before the event's end_date. "
            "May be null while the project is still a draft."
        ),
        verbose_name="Registration End Date",
    )

    status = models.CharField(
        max_length=10,
        choices=RegistrationStatus.choices,
        default=RegistrationStatus.OPEN,
        db_index=True,
        help_text=(
            "Lifecycle state of registration. "
            "'open' — accepting sign-ups (default). "
            "'closed' — organiser manually closed before end date. "
            "'full' — system-set when max_participants reached; "
            "reverts to 'open' if a cancellation drops count below max. "
            "'ended' — Python-side computed value only; NEVER stored here."
        ),
        verbose_name="Registration Status",
    )

    created_at = models.DateTimeField(
        help_text="When this registration configuration was created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="When this registration configuration was last updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    is_draft = models.BooleanField(
        default=False,
        help_text=(
            "When True, the registration configuration is incomplete and not "
            "visible to visitors. The organiser can save partial data and publish "
            "later. May only transition from True to False (one-way)."
        ),
        verbose_name="Is Draft",
    )

    registration_enabled = models.BooleanField(
        default=True,
        help_text=(
            "When False, registration features are hidden for this event. "
            "The config is preserved and can be re-enabled later. "
            "Unlike is_draft, this field is reversible."
        ),
        verbose_name="Registration Enabled",
    )

    notify_admins = models.BooleanField(
        default=True,
        help_text=(
            "When True, team admins receive an email notification whenever "
            "a participant registers or cancels. "
            "Consumed by the admin notification task (see GitHub issue #1888)."
        ),
        verbose_name="Notify Admins",
    )

    last_guest_email_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        default=None,
        db_index=True,
        help_text=(
            "Timestamp of the last bulk email sent to event guests. "
            "NULL if no email has been sent."
        ),
        verbose_name="Last Guest Email Sent At",
    )

    class Meta:
        app_label = "organization"
        verbose_name = "Event Registration Config"
        verbose_name_plural = "Event Registration Configs"

    def __str__(self):
        max_p = self.max_participants if self.max_participants is not None else "—"
        return f"Registration config for '{self.project.name}' (max: {max_p}, status: {self.status})"


class EventRegistration(models.Model):
    """
    Records which users have registered for an event.

    One row per (user, registration_config) pair.  The unique_together constraint
    acts as both a business rule (no duplicate registrations) and a DB-level
    safety net for concurrent requests.

    Soft-delete lifecycle:
        Active     — cancelled_at IS NULL,  cancelled_by IS NULL
        Cancelled  — cancelled_at IS NOT NULL, cancelled_by = the user who cancelled
        Re-registered — cancelled_at reset to NULL, cancelled_by reset to NULL

    ``cancelled_by`` distinguishes self-cancellation from admin/organiser cancellation:
        - Self-cancelled:  cancelled_by == user  → member may re-register
        - Admin-cancelled: cancelled_by != user  → member may NOT self-re-register

    Seat counting (active registrations only):
        A registration books ``number_of_seats`` seats (the registrant plus
        their guests).  ``number_of_seats`` is kept on cancelled rows for display.

        available_seats = registration_config.max_participants
                          - SUM(number_of_seats) over active registrations

    Always use ``organization.utility.event_registration.get_booked_seats`` /
    ``get_available_seats`` — every capacity site must share one calculation.
    No denormalised counter column is used to avoid update-anomaly races.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="event_registrations",
        help_text="The user who registered for the event",
        verbose_name="User",
    )
    registration_config = models.ForeignKey(
        EventRegistrationConfig,
        on_delete=models.CASCADE,
        related_name="registrations",
        help_text="The event registration config this registration belongs to",
        verbose_name="Registration Config",
    )
    registered_at = models.DateTimeField(
        auto_now_add=True,
        help_text="When the user registered for the event",
        verbose_name="Registered At",
    )
    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Timestamp when the registration was cancelled. "
            "NULL means the registration is active. "
            "Reset to NULL on re-registration."
        ),
        verbose_name="Cancelled At",
    )
    cancelled_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cancelled_registrations",
        help_text=(
            "User who cancelled the registration. "
            "Set to the guest when they cancel themselves; "
            "set to the organiser/admin when they cancel on behalf of the guest. "
            "NULL when the registration is active (reset on re-registration)."
        ),
        verbose_name="Cancelled By",
    )
    cancellation_reason = models.TextField(
        null=True,
        blank=True,
        default=None,
        help_text="Optional message provided by the guest when they cancelled.",
        verbose_name="Cancellation Reason",
    )
    number_of_seats = models.PositiveIntegerField(
        default=1,
        db_default=1,
        validators=[MinValueValidator(1)],
        help_text=(
            "Seats booked by this registration (registrant + guests). "
            "Kept on cancelled rows; replaced on re-registration."
        ),
        verbose_name="Number of Seats",
    )

    class Meta:
        app_label = "organization"
        verbose_name = "Event Registration"
        verbose_name_plural = "Event Registrations"
        unique_together = [("user", "registration_config")]
        indexes = [
            models.Index(
                fields=["registration_config"], name="idx_ep_event_registration"
            ),
            models.Index(fields=["user"], name="idx_ep_user"),
        ]

    def __str__(self) -> str:
        return (
            f"{self.user.username} registered for "
            f"'{self.registration_config.project.name}'"
        )


class RegistrationFieldAnswer(models.Model):
    """
    Stores one registrant answer for one custom registration field.

    Exactly one row per (registration, field) pair. The value shape depends on
    the field type:

    - checkbox      -> value_boolean
    - option_select -> value_option
    - inventory     -> value_option + value_number
    - text          -> value_text

    Both foreign keys use CASCADE so deleting a field/option later removes
    dependent answers automatically.
    """

    registration = models.ForeignKey(
        EventRegistration,
        on_delete=models.CASCADE,
        related_name="field_answers",
    )
    field = models.ForeignKey(
        "organization.RegistrationField",
        on_delete=models.CASCADE,
        related_name="answers",
    )
    value_boolean = models.BooleanField(null=True, blank=True)
    value_option = models.ForeignKey(
        "organization.RegistrationFieldOption",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="answers",
    )
    value_number = models.PositiveIntegerField(null=True, blank=True)
    value_text = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "organization"
        verbose_name = "Registration Field Answer"
        verbose_name_plural = "Registration Field Answers"
        unique_together = [("registration", "field")]

    def __str__(self) -> str:
        return (
            f"answer for registration {self.registration_id} " f"field {self.field_id}"
        )
