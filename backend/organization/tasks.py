"""
Celery tasks for the organization app.

Currently includes:
    - send_event_registration_confirmation_email: async confirmation email
      sent after a successful event registration.
    - send_organizer_message_to_guests: async bulk send of an organiser-authored
      email to all active participants for an event.
    - notify_admins_of_registration_change: async notification emails to all
      team admins when a member registers or self-cancels (gated by
      EventRegistrationConfig.notify_admins).
"""

import logging
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from climateconnect_main.celery import app

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_event_registration_confirmation_email(
    self, user_id: int, event_slug: str, registration_id: int
):
    """
    Send a registration confirmation email to a user who just registered for an event.

    This task is dispatched asynchronously (via .delay()) immediately after the
    EventRegistration row is created, so it never blocks the HTTP response.

    Retries up to 3 times with a 60-second delay on transient failures (e.g. Mailjet
    downtime).  Permanent failures (missing user, missing project) are logged and
    not retried.

    Args:
        user_id: Primary key of the registering User.
        event_slug: URL slug of the event Project.
        registration_id: Primary key of the EventRegistration record.
    """
    from organization.models.event_registration import EventRegistration
    from organization.models.project import Project
    from organization.utility.email import (
        send_event_registration_confirmation_to_user,
    )

    try:
        user = User.objects.select_related("user_profile__location").get(id=user_id)
        # add logging
        logger.info(
            "[EventRegistration] Sending confirmation email to user %s for event '%s'",
            user_id,
            event_slug,
        )
    except User.DoesNotExist:
        logger.error(
            "[EventRegistration] Cannot send confirmation: User %s not found", user_id
        )
        return

    try:
        project = (
            Project.objects.select_related("registration_config", "loc", "language")
            .prefetch_related(
                "translation_project__language",
                "project_parent__parent_organization__language",
                "project_parent__parent_organization__translation_org__language",
                "project_parent__parent_user__user_profile",
            )
            .get(url_slug=event_slug)
        )
    except Project.DoesNotExist:
        logger.error(
            "[EventRegistration] Cannot send confirmation: Project '%s' not found",
            event_slug,
        )
        return

    try:
        registration = (
            EventRegistration.objects.select_related("registration_config")
            .prefetch_related(
                "field_answers__field",
                "field_answers__value_option",
                "field_answers__field__options",
            )
            .get(id=registration_id)
        )
    except EventRegistration.DoesNotExist:
        logger.error(
            "[EventRegistration] Cannot send confirmation: Registration %s not found",
            registration_id,
        )
        return

    try:
        send_event_registration_confirmation_to_user(
            user=user, project=project, registration=registration
        )
    except Exception as exc:
        logger.error(
            "[EventRegistration] Failed to send confirmation email to user %s "
            "for event '%s': %s",
            user_id,
            event_slug,
            exc,
        )
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_organizer_message_to_guests(
    self, event_slug: str, user_ids: list, subject: str, message: str
):
    """
    Async bulk send: deliver an organiser-composed email to a list of event guests.

    ``user_ids`` is a pre-computed list of User PKs captured at request time so
    the task operates on a stable snapshot of active participants even if
    cancellations arrive between the HTTP request and task execution.

    Retries up to 3 times with a 60-second delay on transient failure
    (consistent with send_event_registration_confirmation_email).

    Args:
        event_slug: URL slug of the event Project.
        user_ids:   List of User PKs to email.
        subject:    Organiser-provided subject string.
        message:    Organiser-provided plain-text body.
    """
    from organization.models.project import Project
    from organization.utility.email import send_organizer_message_to_guest

    try:
        project = (
            Project.objects.select_related("loc", "language")
            .prefetch_related(
                "translation_project__language",
                "project_parent__parent_organization__language",
                "project_parent__parent_organization__translation_org__language",
                "project_parent__parent_user__user_profile",
            )
            .get(url_slug=event_slug)
        )
    except Project.DoesNotExist:
        logger.error(
            "[OrganizerEmail] Project '%s' not found — aborting bulk send", event_slug
        )
        return

    # TODO #1850: user_ids already captures a snapshot at request time, but once
    # cancelled_at exists the view's queryset should pre-filter cancelled rows
    # so they never enter user_ids in the first place.
    users = User.objects.select_related("user_profile__location").filter(
        id__in=user_ids
    )

    for user in users:
        try:
            send_organizer_message_to_guest(user, project, subject, message)
        except Exception as exc:
            logger.error(
                "[OrganizerEmail] Failed to send to user %s for event '%s': %s",
                user.id,
                event_slug,
                exc,
            )
            raise self.retry(exc=exc)

    logger.info(
        "[OrganizerEmail] Sent organiser email to %d guests for event '%s'",
        len(user_ids),
        event_slug,
    )


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def notify_admins_of_registration_change(
    self, project_id: int, guest_user_id: int, change_type: str
):
    """
    Notify all team admins of a member registration or self-cancellation.

    Dispatched asynchronously (via .delay()) inside a ``transaction.on_commit``
    callback so it only fires after the enclosing DB transaction commits
    successfully.

    The task re-reads ``EventRegistrationConfig.notify_admins`` from the DB
    before doing any work — if the flag has been toggled off between the HTTP
    request and task execution, the task exits early without sending any emails.

    One admin's email failure does not prevent notifications to other admins:
    each send is wrapped in its own try/except.  If any admin's send fails, the
    task retries (up to 3 times, 60-second delay) so the failing admin eventually
    receives their notification.

    Args:
        project_id:    Primary key of the event Project.
        guest_user_id: Primary key of the member who registered or cancelled.
        change_type:   ``"registered"`` or ``"cancelled"``.
    """
    from climateconnect_api.models import Role
    from organization.models.event_registration import (
        EventRegistration,
        EventRegistrationConfig,
    )
    from organization.models.project import Project
    from organization.utility.email import (
        send_admin_event_notification,
        should_show_seats,
    )

    # ── 1. Look up project ────────────────────────────────────────────────────
    try:
        project = (
            Project.objects.select_related("loc", "language")
            .prefetch_related(
                "translation_project__language",
                "project_parent__parent_organization__language",
                "project_parent__parent_organization__translation_org__language",
                "project_parent__parent_user__user_profile",
            )
            .get(id=project_id)
        )
    except Project.DoesNotExist:
        logger.warning(
            "[AdminNotification] Project %s not found — aborting admin notification",
            project_id,
        )
        return

    # ── 2. Look up guest user ─────────────────────────────────────────────────
    try:
        guest_user = User.objects.select_related("user_profile").get(id=guest_user_id)
    except User.DoesNotExist:
        logger.warning(
            "[AdminNotification] Guest user %s not found — aborting admin notification",
            guest_user_id,
        )
        return

    # ── 3. Re-check notify_admins flag (may have been toggled since dispatch) ─
    try:
        rc = EventRegistrationConfig.objects.get(project=project)
    except EventRegistrationConfig.DoesNotExist:
        logger.warning(
            "[AdminNotification] No EventRegistrationConfig for project %s — aborting",
            project_id,
        )
        return

    if not rc.notify_admins:
        logger.info(
            "[AdminNotification] notify_admins=False for project %s — skipping",
            project_id,
        )
        return

    # ── 3a. Seat count of the guest's registration (only for multi-seat events) ─
    number_of_seats = None
    registration = (
        EventRegistration.objects.select_related("registration_config")
        .filter(registration_config=rc, user=guest_user)
        .first()
    )
    if registration is not None and should_show_seats(registration):
        number_of_seats = registration.number_of_seats

    # ── 4. Fetch all team admins (organiser + write-access project members) ───
    # ProjectMember.user has related_name="project_member_user" (see organization/models/members.py)
    admin_users = User.objects.select_related("user_profile__location").filter(
        project_member_user__project=project,
        project_member_user__role__role_type__in=[Role.ALL_TYPE, Role.READ_WRITE_TYPE],
    )

    if not admin_users.exists():
        logger.info(
            "[AdminNotification] No team admins found for project %s — nothing to send",
            project_id,
        )
        return

    # ── 5. Send notification to each admin; failures are isolated ─────────────
    failed = False
    for admin in admin_users:
        try:
            send_admin_event_notification(
                admin_user=admin,
                project=project,
                guest_user=guest_user,
                change_type=change_type,
                number_of_seats=number_of_seats,
            )
            logger.info(
                "[AdminNotification] Sent %s notification to admin %s for project %s",
                change_type,
                admin.id,
                project_id,
            )
        except Exception as exc:
            logger.error(
                "[AdminNotification] Failed to send %s notification to admin %s "
                "for project %s: %s",
                change_type,
                admin.id,
                project_id,
                exc,
            )
            failed = True

    if failed:
        raise self.retry(
            exc=Exception(
                f"[AdminNotification] One or more admin notifications failed for project {project_id}"
            )
        )


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_cancellation_chat_message(
    self,
    guest_user_id: int,
    project_url_slug: str,
    registration_id: int,
    message: str,
):
    """Send a cancellation chat message from guest to event organizer.

    The created message is tagged with origin metadata so the frontend can
    render event-registration context in chat.
    """
    from chat_messages.models import Message, MessageReceiver
    from chat_messages.utility.chat_setup import get_or_create_private_chat
    from chat_messages.utility.notification import create_chat_message_notification
    from climateconnect_api.utility.notification import (
        create_email_notification,
        create_user_notification,
    )
    from organization.models.project import Project
    from organization.utility.project import get_project_admin_creators

    try:
        guest_user = User.objects.select_related("user_profile").get(id=guest_user_id)
    except User.DoesNotExist:
        logger.warning(
            "[CancellationChat] Guest user %s not found; skipping",
            guest_user_id,
        )
        return

    try:
        project = (
            Project.objects.select_related("loc", "language")
            .prefetch_related(
                "translation_project__language",
                "project_parent__parent_organization__language",
                "project_parent__parent_organization__translation_org__language",
                "project_parent__parent_user__user_profile",
            )
            .get(url_slug=project_url_slug)
        )
    except Project.DoesNotExist:
        logger.warning(
            "[CancellationChat] Project '%s' not found; skipping",
            project_url_slug,
        )
        return

    try:
        organizers = get_project_admin_creators(project)
        if not organizers:
            logger.warning(
                "[CancellationChat] No organizers found for project '%s'; skipping",
                project_url_slug,
            )
            return

        organizer = organizers[0]
        if organizer.id == guest_user.id:
            logger.info(
                "[CancellationChat] Guest %s is organizer for project '%s'; skipping self-message",
                guest_user.id,
                project_url_slug,
            )
            return

        chat = get_or_create_private_chat(
            guest_user,
            organizer,
            created_by=guest_user,
        )

        # Idempotency guard: Celery retries can happen after message creation
        # (for example when downstream notification/email delivery fails).
        # Reuse a very recent matching origin message instead of creating duplicates.
        recent_cutoff = timezone.now() - timedelta(minutes=10)
        chat_message = (
            Message.objects.filter(
                message_participant=chat,
                sender=guest_user,
                origin_type="event_registration",
                origin_id=registration_id,
                content=message,
                sent_at__gte=recent_cutoff,
            )
            .order_by("-id")
            .first()
        )

        if chat_message is None:
            sent_at = timezone.now()
            chat_message = Message.objects.create(
                message_participant=chat,
                content=message,
                sender=guest_user,
                origin_type="event_registration",
                origin_id=registration_id,
                sent_at=sent_at,
            )
            chat.last_message_at = sent_at
            chat.save(update_fields=["last_message_at"])

        MessageReceiver.objects.get_or_create(receiver=organizer, message=chat_message)

        notification = create_chat_message_notification(chat)
        try:
            create_user_notification(organizer, notification)
        except Exception as exc:
            logger.error(
                "[CancellationChat] Failed to create in-app notification for organizer %s: %s",
                organizer.id,
                exc,
            )
        try:
            create_email_notification(
                organizer, chat, message, guest_user, notification
            )
        except Exception as exc:
            logger.error(
                "[CancellationChat] Failed to create email notification for organizer %s: %s",
                organizer.id,
                exc,
            )
    except Exception as exc:
        logger.error(
            "[CancellationChat] Failed for guest %s on project '%s': %s",
            guest_user_id,
            project_url_slug,
            exc,
        )
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def generate_image_variants(self, app_label, model_name, pk, field_names):
    """Generate resized WebP variants for image fields on a model instance.

    Dispatched asynchronously (via ``transaction.on_commit``) whenever an
    image field on ``Project``, ``Organization``, or ``UserProfile`` changes.

    The task re-fetches the instance from the database so it always operates
    on committed data.  All errors are caught and logged — a variant-
    generation failure never propagates to the caller and never rolls back
    the original save.

    Args:
        app_label: Django app label of the model (e.g. ``"organization"``).
        model_name: Model class name (e.g. ``"Project"``).
        pk: Primary key of the instance.
        field_names: List of image field names that changed.
    """
    from django.apps import apps

    from climateconnect_main.utility.image_variants import (
        IMAGE_VARIANT_CONFIGS,
        generate_and_store_variants,
    )

    if model_name not in IMAGE_VARIANT_CONFIGS:
        logger.info(
            "[ImageVariants] No variant config for %s.%s — skipping",
            app_label,
            model_name,
        )
        return

    model = apps.get_model(app_label, model_name)

    try:
        instance = model.objects.get(pk=pk)
    except model.DoesNotExist:
        logger.warning(
            "[ImageVariants] Instance not found: %s.%s pk=%s",
            app_label,
            model_name,
            pk,
        )
        return

    try:
        generate_and_store_variants(instance, field_names=field_names)
    except Exception as exc:  # noqa: BLE001 — never break the task chain
        logger.error(
            "[ImageVariants] Failed to generate variants for %s.%s pk=%s: %s",
            app_label,
            model_name,
            pk,
            exc,
        )
