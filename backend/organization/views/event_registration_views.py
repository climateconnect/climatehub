import logging

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from chat_messages.models import Participant
from climateconnect_api.models import Role
from climateconnect_api.utility.html import sanitize_html
from organization.models import Project, ProjectMember
from organization.models.event_registration import (
    EventRegistration,
    EventRegistrationConfig,
    RegistrationFieldAnswer,
    RegistrationStatus,
)
from organization.models.registration_field import (
    RegistrationFieldOption,
    RegistrationFieldType,
)
from organization.serializers.event_registration import (
    EditEventRegistrationConfigSerializer,
    EventRegistrationConfigSerializer,
    EventRegistrationSerializer,
    EventRegistrationSubmissionSerializer,
    SendOrganizerEmailSerializer,
    _compute_effective_status,
    sync_registration_answers,
)
from organization.tasks import (
    notify_admins_of_registration_change as _notify_admins_task,
)
from organization.tasks import (
    send_cancellation_chat_message as _send_cancellation_chat_task,
)
from organization.tasks import (
    send_event_registration_confirmation_email as _send_registration_email,
)
from organization.tasks import (
    send_organizer_message_to_guests as _send_organizer_email_task,
)
from organization.utility.email import (
    send_guest_cancellation_notification,
    send_organizer_message_to_guest,
)
from organization.utility.event_registration import evaluate_registration_status

logger = logging.getLogger(__name__)


class EventRegistrationsView(APIView):
    """
    POST /api/projects/{url_slug}/registrations/  — Member registers for the event.
    GET  /api/projects/{url_slug}/registrations/  — Organiser lists all registrations.

    POST behaviour:
        - 201 Created  — first-time registration or re-registration after self-cancellation.
        - 200 OK       — idempotent; user already has an active registration.
        - 400 Bad Request — registration is closed, full, or deadline has passed.
        - 401 Unauthorized — unauthenticated request.
        - 403 Forbidden — user's registration was cancelled by an admin; cannot re-register.
        - 404 Not Found — project or registration_config does not exist.

    GET behaviour (organiser/admin only):
        Returns ALL registrations (active and cancelled) ordered by registered_at asc.
        Includes ``id`` and ``cancelled_at`` on each row so the frontend can
        distinguish active from cancelled and target individual rows for admin-cancellation.
        No backend pagination; client-side paging via MUI DataGrid.

    See spec: doc/spec/20260309_0900_member_register_for_event.md
             doc/spec/20260309_1500_member_cancel_event_registration.md
             doc/spec/20260401_1000_organizer_see_registration_status.md
    """

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, url_slug):
        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Look up EventRegistrationConfig (lock row for duration of txn) ─
        try:
            rc = EventRegistrationConfig.objects.select_for_update().get(
                project=project
            )
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": "This project does not have event registration enabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 3. Check for an existing record (active OR cancelled) ────────────
        try:
            existing = EventRegistration.objects.select_for_update().get(
                user=request.user, registration_config=rc
            )
        except EventRegistration.DoesNotExist:
            existing = None

        if existing is not None:
            if existing.cancelled_at is None:
                # Already actively registered — idempotent.
                return Response(
                    {
                        "registered": True,
                        "available_seats": self._compute_available_seats(rc),
                    },
                    status=status.HTTP_200_OK,
                )
            else:
                # A cancelled record exists.
                if existing.cancelled_by_id != request.user.id:
                    # Admin-cancelled — member may not self-re-register.
                    return Response(
                        {
                            "message": (
                                "Your registration was cancelled by an administrator. "
                                "You cannot re-register for this event."
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )
                # Self-cancelled — fall through to registration-open check,
                # then re-use the existing row.

        # ── 4. Validate that registration is currently open ──────────────────
        effective_status = _compute_effective_status(rc)
        if effective_status != RegistrationStatus.OPEN:
            _message_map = {
                RegistrationStatus.CLOSED: "Registration is currently closed.",
                RegistrationStatus.FULL: "The event is fully booked.",
                RegistrationStatus.ENDED: "The registration deadline has passed.",
            }
            return Response(
                {
                    "message": _message_map.get(
                        effective_status, "Registration is not available."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 5. Capacity check (inside the lock; active registrations only) ───
        # Use the consolidated utility which checks max_participants AND
        # required capacity-limited fields (inventory, time slots).
        suggested_status = evaluate_registration_status(rc)
        if suggested_status == RegistrationStatus.FULL:
            if rc.status in (
                RegistrationStatus.OPEN,
                RegistrationStatus.FULL,
            ):
                rc.status = RegistrationStatus.FULL
                rc.save(update_fields=["status", "updated_at"])
            return Response(
                {"message": "Sorry, the event is now fully booked."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 6. Validate custom-field answers payload (if provided) ──────────
        submission_serializer = EventRegistrationSubmissionSerializer(
            data=request.data,
            context={"registration_config": rc},
        )
        if not submission_serializer.is_valid():
            return Response(
                submission_serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )
        normalized_answers = submission_serializer.validated_data.get(
            "normalized_answers", []
        )

        # ── 6a. Per-option capacity enforcement for inventory & time slot answers ─
        inventory_answers = [
            a for a in normalized_answers if a.get("value_number") is not None
        ]
        time_slot_answers = [
            a
            for a in normalized_answers
            if a["field"].field_type == RegistrationFieldType.TIME_SLOT_SELECT
        ]
        all_option_ids = list(
            set(
                [a["value_option"].id for a in inventory_answers]
                + [a["value_option"].id for a in time_slot_answers]
            )
        )
        if all_option_ids:
            # Lock option rows ordered by id to prevent deadlocks.
            locked_options = {
                o.id: o
                for o in RegistrationFieldOption.objects.filter(id__in=all_option_ids)
                .select_for_update()
                .order_by("id")
            }
            field_errors = {}

            # Inventory capacity check (quantity-based).
            for answer in inventory_answers:
                option = locked_options[answer["value_option"].id]
                requested = answer["value_number"]
                if option.available_amount is not None:
                    booked = (
                        RegistrationFieldAnswer.objects.filter(
                            value_option=option,
                            registration__cancelled_at__isnull=True,
                        ).aggregate(booked=Sum("value_number"))["booked"]
                        or 0
                    )
                    if booked + requested > option.available_amount:
                        remaining = max(0, option.available_amount - booked)
                        field_errors[str(answer["field"].id)] = (
                            f"Only {remaining} item{'s' if remaining != 1 else ''} "
                            f"remaining for the selected option."
                        )

            # Time slot capacity check (seat-count-based).
            for answer in time_slot_answers:
                option = locked_options[answer["value_option"].id]
                if option.available_amount is not None:
                    booked = RegistrationFieldAnswer.objects.filter(
                        value_option=option,
                        registration__cancelled_at__isnull=True,
                    ).count()
                    if booked >= option.available_amount:
                        field_errors[str(answer["field"].id)] = (
                            "This time slot is fully booked. "
                            "Please select a different slot."
                        )

            if field_errors:
                return Response(
                    {"field_errors": field_errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # ── 7. Create or re-activate EventRegistration ───────────────────────
        registration = existing
        if existing is not None:
            # Re-registration: reset soft-delete fields on the existing row.
            existing.cancelled_at = None
            existing.cancelled_by = None
            existing.save(update_fields=["cancelled_at", "cancelled_by"])
        else:
            registration = EventRegistration.objects.create(
                user=request.user,
                registration_config=rc,
            )

        sync_registration_answers(registration, normalized_answers)

        # ── 8. Update status to FULL if last seat was just taken ─────────────
        available_seats = None
        if rc.max_participants is not None:
            new_count = EventRegistration.objects.filter(
                registration_config=rc,
                cancelled_at__isnull=True,
            ).count()
            available_seats = max(0, rc.max_participants - new_count)

        # Check all capacity conditions (max_participants + required fields).
        suggested_status = evaluate_registration_status(rc)
        if suggested_status == RegistrationStatus.FULL:
            rc.status = RegistrationStatus.FULL
            rc.save(update_fields=["status", "updated_at"])

        logger.info(
            "[EventRegistration] User %s registered for project '%s'",
            request.user.id,
            project.url_slug,
        )

        # ── 9. Dispatch async confirmation email ──────────────────────────────
        # Capture values eagerly — lambda closes over variables by reference, so
        # evaluating request.user.id inside the lambda would run after the
        # transaction commits, at which point DRF may resolve a different user.
        _user_id = request.user.id
        _event_slug = project.url_slug
        _registration_id = registration.id
        transaction.on_commit(
            lambda: _send_registration_email.delay(
                user_id=_user_id,
                event_slug=_event_slug,
                registration_id=_registration_id,
            )
        )

        # ── 10. Dispatch async admin notification (only when notify_admins=True) ─
        # Re-check is done inside the task to handle flag toggling between
        # dispatch and execution.  No extra DB query here when flag is False.
        if rc.notify_admins:
            _project_id = project.id
            _guest_user_id = request.user.id
            transaction.on_commit(
                lambda: _notify_admins_task.delay(
                    project_id=_project_id,
                    guest_user_id=_guest_user_id,
                    change_type="registered",
                )
            )

        return Response(
            {"registered": True, "available_seats": available_seats},
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _compute_available_seats(rc: EventRegistrationConfig):
        """Return remaining seats or None for unlimited-capacity events.

        Only active (non-cancelled) registrations count against capacity.
        """
        if rc.max_participants is None:
            return None
        count = EventRegistration.objects.filter(
            registration_config=rc,
            cancelled_at__isnull=True,
        ).count()
        return max(0, rc.max_participants - count)

    def get(self, request, url_slug):
        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Check organiser/admin permission ─────────────────────────────
        has_edit_rights = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not has_edit_rights:
            return Response(
                {
                    "message": (
                        "You do not have permission to view registrations "
                        "for this project."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 3. Look up EventRegistrationConfig ───────────────────────────────
        try:
            rc = project.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": "This project does not have event registration enabled."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 4. Query ALL registrations (active + cancelled) ──────────────────
        # Returns all rows so organisers can see the full history including
        # cancellations. ``id`` and ``cancelled_at`` are included in the response
        # so the frontend can target individual rows for admin-cancellation.
        #
        # ``prefetch_related`` for ``field_answers`` (and the related field /
        # option rows) resolves custom-field answer data in a constant number
        # of queries regardless of how many registrations are returned — no
        # N+1 even on events with many registrants and 15 custom fields.
        registrations = (
            EventRegistration.objects.select_related("user__user_profile")
            .prefetch_related(
                "field_answers__field",
                "field_answers__value_option",
            )
            .filter(registration_config=rc)
            .order_by("registered_at")
        )

        serializer = EventRegistrationSerializer(
            registrations, many=True, context={"request": request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, url_slug):
        """
        DELETE /api/projects/{url_slug}/registrations/

        Allows the authenticated member to cancel their own registration for an
        upcoming event (soft delete: sets ``cancelled_at`` and ``cancelled_by``).

        Response codes:
            204 No Content  — cancellation successful.
            400 Bad Request — event has already started.
            401 Unauthorized — unauthenticated request.
            403 Forbidden   — registration belongs to a different user.
            404 Not Found   — no active registration exists for this user and event.

        See spec: doc/spec/20260309_1500_member_cancel_event_registration.md
        """

        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Look up EventRegistrationConfig ───────────────────────────────
        try:
            rc = EventRegistrationConfig.objects.select_for_update().get(
                project=project
            )
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": "This project does not have event registration enabled."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 3. Look up the registration record for the requesting user ───────
        #       Explicit ownership check gives 403 instead of a silent 404 when a
        #       registration exists for a different user.
        try:
            reg = EventRegistration.objects.select_for_update().get(
                registration_config=rc,
                user=request.user,
            )
        except EventRegistration.DoesNotExist:
            return Response(
                {"message": "You do not have an active registration for this event."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 4. Ownership check (explicit, per spec) ──────────────────────────
        if reg.user_id != request.user.id:
            return Response(
                {"message": "You do not have permission to cancel this registration."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 5. Check registration is currently active ────────────────────────
        if reg.cancelled_at is not None:
            return Response(
                {"message": "You do not have an active registration for this event."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 6. Check event has not yet started ───────────────────────────────
        if project.start_date and project.start_date <= timezone.now():
            return Response(
                {
                    "message": "Cannot cancel a registration for an event that has already started."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 6a. Optional cancellation message ───────────────────────────────
        message_raw = request.data.get("message", "")
        if message_raw is None:
            message_raw = ""
        if not isinstance(message_raw, str):
            return Response(
                {"message": "Message must be a string."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        message = message_raw.strip()
        if message and len(message) > 1000:
            return Response(
                {"message": "Message must be 1000 characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 7. Soft-delete: set cancelled_at and cancelled_by ────────────────
        reg.cancelled_at = timezone.now()
        reg.cancelled_by = request.user
        update_fields = ["cancelled_at", "cancelled_by"]
        if message:
            reg.cancellation_reason = message
            update_fields.append("cancellation_reason")
        reg.save(update_fields=update_fields)

        # ── 8. Revert FULL → OPEN if cancellation freed capacity ────────────
        if rc.status == RegistrationStatus.FULL:
            suggested_status = evaluate_registration_status(rc)
            if suggested_status == RegistrationStatus.OPEN:
                rc.status = RegistrationStatus.OPEN
                rc.save(update_fields=["status", "updated_at"])

        logger.info(
            "[EventRegistration] User %s cancelled registration for project '%s'",
            request.user.id,
            project.url_slug,
        )

        # ── 9. Dispatch async admin notification (only when notify_admins=True) ─
        # This is a self-cancellation, so the admin notification is appropriate.
        # Capture values eagerly before the transaction commits.
        if rc.notify_admins:
            _project_id = project.id
            _guest_user_id = request.user.id
            transaction.on_commit(
                lambda: _notify_admins_task.delay(
                    project_id=_project_id,
                    guest_user_id=_guest_user_id,
                    change_type="cancelled",
                )
            )

        # ── 10. Optional cancellation chat message to organizer ─────────────
        if message:
            _guest_user_id = request.user.id
            _project_url_slug = project.url_slug
            _registration_id = reg.id
            _message = message

            def _dispatch_cancellation_chat_message():
                try:
                    _send_cancellation_chat_task.delay(
                        guest_user_id=_guest_user_id,
                        project_url_slug=_project_url_slug,
                        registration_id=_registration_id,
                        message=_message,
                    )
                except Exception as exc:
                    logger.error(
                        "[EventRegistration] Failed to dispatch cancellation chat message "
                        "for registration %s: %s",
                        _registration_id,
                        exc,
                    )

            transaction.on_commit(_dispatch_cancellation_chat_message)

        return Response(status=status.HTTP_204_NO_CONTENT)


class EventRegistrationOriginView(APIView):
    """Resolve event context for event-registration-origin chat messages."""

    permission_classes = [IsAuthenticated]

    def get(self, request, registration_id):
        try:
            registration = EventRegistration.objects.select_related(
                "registration_config__project"
            ).get(id=registration_id)
        except EventRegistration.DoesNotExist:
            return Response(
                {"message": "Registration not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        project = registration.registration_config.project

        is_chat_participant = Participant.objects.filter(
            user=request.user,
            is_active=True,
            chat__participant_message__origin_type="event_registration",
            chat__participant_message__origin_id=registration_id,
        ).exists()

        is_project_admin = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()

        if not (is_chat_participant or is_project_admin):
            return Response(
                {
                    "message": (
                        "You do not have permission to access this registration origin."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "event_name": project.name,
                "event_url_slug": project.url_slug,
            },
            status=status.HTTP_200_OK,
        )


class EditRegistrationConfigView(APIView):
    """
    POST /api/projects/{url_slug}/registration-config/
    PATCH /api/projects/{url_slug}/registration-config/

    POST: Creates a new draft registration config for an event, or re-enables
          an existing disabled config. Requires project admin role.

    PATCH: Allows an event organiser (or team admin) to update registration
           settings for an event that already has EventRegistrationConfig.

    Editable fields (PATCH):
        - max_participants  (positive integer or null for unlimited)
        - registration_end_date  (datetime)
        - status  ("open" or "closed" only — "full" and "ended" are system-managed)
        - registration_enabled  (boolean — disable/enable registration)

    Status change rules:
        - "open" → "closed"   Organiser manually closes registration.
        - "closed" → "open"   Organiser reopens (permitted unless deadline has passed).
        - "full" → "open"     Organiser overrides the system capacity block.
        - Setting "open" when effective_status == "ended" (deadline has passed)
          returns 400 — extend registration_end_date first, then reopen.
        - "full" and "ended" cannot be set via the API (400 Bad Request).
        - Setting status to its current stored value is idempotent (200 OK).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        """Create or re-enable a registration config for an event."""

        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Verify event project type ────────────────────────────────────
        from organization.models.type import ProjectTypesChoices

        if (
            not project.project_type
            or project.project_type != ProjectTypesChoices.event
        ):
            return Response(
                {"message": "Registration is only available for event projects."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 3. Check edit rights ────────────────────────────────────────────
        has_edit_rights = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not has_edit_rights:
            return Response(
                {"message": "You do not have permission to edit this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 4. Check for existing config ────────────────────────────────────
        try:
            rc = project.registration_config
            if rc.registration_enabled:
                return Response(
                    {"message": "Registration is already enabled for this event."},
                    status=status.HTTP_409_CONFLICT,
                )
            # Re-enable existing disabled config
            rc.registration_enabled = True
            rc.save(update_fields=["registration_enabled", "updated_at"])
            serializer = EventRegistrationConfigSerializer(
                rc, context={"include_seat_count": True}
            )
            return Response(serializer.data, status=status.HTTP_200_OK)
        except EventRegistrationConfig.DoesNotExist:
            pass

        # ── 5. Create new draft config ──────────────────────────────────────
        # Don't allow adding registration to past events.
        if project.end_date and project.end_date < timezone.now():
            return Response(
                {"message": "Cannot add registration to a past event."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rc = EventRegistrationConfig.objects.create(
            project=project,
            is_draft=True,
            registration_enabled=True,
            status=RegistrationStatus.OPEN,
        )
        serializer = EventRegistrationConfigSerializer(
            rc, context={"include_seat_count": True}
        )
        logger.info(
            "[EventRegistration] Organiser %s created registration config for '%s'",
            request.user.id,
            url_slug,
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def patch(self, request, url_slug):
        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = Project.objects.get(url_slug=url_slug)
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Check edit rights (after project lookup so 404 takes priority) ─
        has_edit_rights = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not has_edit_rights:
            return Response(
                {"message": "You do not have permission to edit this project."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 3. Look up EventRegistrationConfig ───────────────────────────────
        try:
            rc = project.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": ("This project does not have event registration enabled.")},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 4. Handle registration_enabled toggle ────────────────────────────
        # When only registration_enabled is in the request body, skip full
        # validation — it's a simple boolean toggle.
        if "registration_enabled" in request.data and len(request.data) == 1:
            rc.registration_enabled = bool(request.data["registration_enabled"])
            rc.save(update_fields=["registration_enabled", "updated_at"])
            serializer = EventRegistrationConfigSerializer(
                rc, context={"include_seat_count": True}
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        # ── 5. Validate and save ─────────────────────────────────────────────
        # Derive is_draft from the config's own state, not the project's.
        # Draft configs skip publish-time field validation (e.g. empty checkbox
        # description) without requiring the frontend to pass extra state.
        # When is_draft is in the request body, the serializer handles the
        # draft → published transition and runs full validation.
        is_draft = rc.is_draft
        if "is_draft" in request.data:
            is_draft = bool(request.data["is_draft"])
        serializer = EditEventRegistrationConfigSerializer(
            rc,
            data=request.data,
            partial=True,
            context={"project": project, "request": request, "is_draft": is_draft},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        serializer.save()

        logger.info(
            "[EventRegistration] Organiser %s updated registration settings for '%s'",
            request.user.id,
            url_slug,
        )

        return Response(serializer.data, status=status.HTTP_200_OK)


class SendOrganizerEmailView(APIView):
    """
    POST /api/projects/{url_slug}/registrations/email/

    Sends an organiser-authored plain-text email to all active event guests
    **and all team admins** (``is_test=false``), or a single test copy to the
    authenticated organiser (``is_test=true``).

    For bulk sends, the recipient list is the union of active (non-cancelled)
    registered guests and project members with organiser/write-access role.
    A team admin who is also a registered guest receives only one copy.

    Always returns ``{"sent_count": <int>}`` — total unique recipients for bulk,
    ``1`` for test.
    Bulk dispatch is asynchronous (Celery task); test dispatch is synchronous.

    The subject is prefixed with ``"[TEST] "`` for test sends so the organiser
    can recognise them in their inbox.

    See spec: doc/spec/20260414_1300_send_email_to_guests_improvements.md
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, url_slug):
        # ── 1. Validate input ────────────────────────────────────────────
        serializer = SendOrganizerEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        subject = serializer.validated_data["subject"]
        message = serializer.validated_data["message"]
        is_test = serializer.validated_data["is_test"]

        # Sanitize HTML — strip XSS, disallowed tags, and filter styles.
        ORGANIZER_EMAIL_ALLOWED_TAGS = [
            "p",
            "strong",
            "b",
            "em",
            "i",
            "a",
            "br",
            "ul",
            "ol",
            "li",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
        ]
        ORGANIZER_EMAIL_ALLOWED_ATTRIBUTES = {
            "a": ["href", "target"],
            "p": ["style"],
            "td": ["style", "colspan", "rowspan"],
            "th": ["style", "colspan", "rowspan"],
        }
        message = sanitize_html(
            message,
            allowed_tags=ORGANIZER_EMAIL_ALLOWED_TAGS,
            allowed_attributes=ORGANIZER_EMAIL_ALLOWED_ATTRIBUTES,
        )

        # ── 2. Look up project ──────────────────────────────────────────
        try:
            project = (
                Project.objects.select_related("loc", "language")
                .prefetch_related(
                    "translation_project__language",
                    "project_parent__parent_organization__language",
                    "project_parent__parent_organization__translation_org__language",
                    "project_parent__parent_user__user_profile",
                )
                .get(url_slug=url_slug)
            )
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 3. Permission check — organiser or team admin ───────────────
        has_edit_rights = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not has_edit_rights:
            return Response(
                {
                    "message": (
                        "You do not have permission to send emails for this event."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 4. Look up EventRegistrationConfig ───────────────────────────
        try:
            rc = project.registration_config
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": "This project does not have event registration enabled."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if is_test:
            # Synchronous — single email to the organiser themselves.
            # Prepend "[TEST] " so the organiser can identify it in their inbox.
            test_subject = "[TEST] {}".format(subject)
            organiser = User.objects.select_related("user_profile__location").get(
                id=request.user.id
            )
            try:
                send_organizer_message_to_guest(
                    organiser, project, test_subject, message
                )
            except Exception as exc:
                logger.error(
                    "[OrganizerEmail] Test send failed for user %s, event '%s': %s",
                    request.user.id,
                    url_slug,
                    exc,
                )
                return Response(
                    {"message": "Failed to send test email. Please try again."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({"sent_count": 1}, status=status.HTTP_200_OK)

        # ── 5. Bulk send — active guests + team admins (deduped) ────────
        send_to_new_guests_only = serializer.validated_data.get(
            "send_to_new_guests_only", False
        )

        guest_qs = EventRegistration.objects.filter(
            registration_config=rc,
            cancelled_at__isnull=True,
        )

        # Apply new-guests-only filter: only guests who registered after
        # the last bulk email send.  Ignored when the flag is False or when
        # no prior bulk email has been sent (last_guest_email_sent_at is NULL).
        if send_to_new_guests_only and rc.last_guest_email_sent_at:
            guest_qs = guest_qs.filter(registered_at__gt=rc.last_guest_email_sent_at)

        guest_user_ids = set(guest_qs.values_list("user_id", flat=True))

        # Team admins receive a copy so they have full visibility into
        # communications sent to attendees (#1886).
        admin_user_ids = set(
            ProjectMember.objects.filter(
                project=project,
                role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            ).values_list("user_id", flat=True)
        )

        # A team admin who is also a registered guest must receive only one copy.
        combined_user_ids = list(guest_user_ids | admin_user_ids)
        sent_count = len(combined_user_ids)

        _send_organizer_email_task.delay(
            event_slug=url_slug,
            user_ids=combined_user_ids,
            subject=subject,
            message=message,
        )

        logger.info(
            "[OrganizerEmail] Bulk send dispatched for event '%s': %d recipients "
            "(%d guests, %d admins, %d overlap)",
            url_slug,
            sent_count,
            len(guest_user_ids),
            len(admin_user_ids),
            len(guest_user_ids & admin_user_ids),
        )

        # Update the timestamp so future "new guests only" sends can filter.
        rc.last_guest_email_sent_at = timezone.now()
        rc.save(update_fields=["last_guest_email_sent_at"])

        return Response({"sent_count": sent_count}, status=status.HTTP_200_OK)


class AdminCancelRegistrationView(APIView):
    """
    PATCH /api/projects/{url_slug}/registrations/{registration_id}/

    Allows an event organiser or team admin to cancel a specific guest's
    registration (soft delete: sets ``cancelled_at`` and ``cancelled_by``).

    An optional ``message`` field in the request body triggers a cancellation
    notification email to the guest. If absent or empty, no email is sent.

    Response codes:
        204 No Content  — cancellation successful.
        400 Bad Request — registration already cancelled, or message exceeds 1000 chars.
        401 Unauthorized — unauthenticated request.
        403 Forbidden   — authenticated but not an organiser or team admin.
        404 Not Found   — project, registration config, or registration not found.

    See spec: doc/spec/20260407_1000_organizer_cancel_guest_registration.md
    """

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def patch(self, request, url_slug, registration_id):
        # ── 1. Look up project ──────────────────────────────────────────────
        try:
            project = (
                Project.objects.select_related("loc", "language")
                .prefetch_related(
                    "translation_project__language",
                    "project_parent__parent_organization__language",
                    "project_parent__parent_organization__translation_org__language",
                    "project_parent__parent_user__user_profile",
                )
                .get(url_slug=url_slug)
            )
        except Project.DoesNotExist:
            return Response(
                {"message": "Project not found: {}".format(url_slug)},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 2. Organiser/admin permission check ─────────────────────────────
        has_edit_rights = ProjectMember.objects.filter(
            user=request.user,
            role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
            project=project,
        ).exists()
        if not has_edit_rights:
            return Response(
                {
                    "message": (
                        "You do not have permission to cancel registrations "
                        "for this project."
                    )
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ── 3. Look up EventRegistrationConfig ───────────────────────────────
        try:
            rc = EventRegistrationConfig.objects.select_for_update().get(
                project=project
            )
        except EventRegistrationConfig.DoesNotExist:
            return Response(
                {"message": "This project does not have event registration enabled."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 4. Look up the specific EventRegistration by ID ─────────────────
        try:
            reg = EventRegistration.objects.select_for_update().get(
                id=registration_id,
                registration_config=rc,
            )
        except EventRegistration.DoesNotExist:
            return Response(
                {"message": "Registration not found on this project."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── 5. Guard: already cancelled → 400 ───────────────────────────────
        if reg.cancelled_at is not None:
            return Response(
                {"message": "This registration is already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 6. Soft-delete: set cancelled_at and cancelled_by ────────────────
        reg.cancelled_at = timezone.now()
        reg.cancelled_by = request.user
        reg.save(update_fields=["cancelled_at", "cancelled_by"])

        # ── 7. Revert FULL → OPEN if cancellation freed capacity ────────────
        if rc.status == RegistrationStatus.FULL:
            suggested_status = evaluate_registration_status(rc)
            if suggested_status == RegistrationStatus.OPEN:
                rc.status = RegistrationStatus.OPEN
                rc.save(update_fields=["status", "updated_at"])

        logger.info(
            "[EventRegistration] Admin %s cancelled registration %s for project '%s'",
            request.user.id,
            registration_id,
            project.url_slug,
        )

        # ── 8. Optional cancellation notification email ──────────────────────
        message = request.data.get("message", "").strip()
        if message and len(message) > 1000:
            return Response(
                {"message": "Message must be 1000 characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if message:
            guest = reg.user
            try:
                # Re-fetch guest with location for email helper.
                guest = User.objects.select_related("user_profile__location").get(
                    id=guest.id
                )
                send_guest_cancellation_notification(guest, project, message)
            except Exception as exc:
                # Log but do not fail the request — cancellation is already committed.
                logger.error(
                    "[AdminCancelRegistration] Email to guest %s failed for event '%s': %s",
                    guest.id,
                    url_slug,
                    exc,
                )

        return Response(status=status.HTTP_204_NO_CONTENT)
