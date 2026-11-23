from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.contrib.auth.models import User
from hubs.models.hub import Hub


class DonationGoal(models.Model):
    name = models.CharField(
        help_text="Goal name, e.g. 'December goal'",
        verbose_name="Goal name",
        max_length=512,
    )

    name_de_translation = models.CharField(
        help_text="German translation of the goal name",
        verbose_name="Goal name (DE)",
        max_length=512,
        null=True,
        blank=True,
    )

    description = models.CharField(
        help_text="The description of the goal",
        verbose_name="Goal description",
        max_length=2048,
    )

    start_date = models.DateTimeField(
        help_text="Date and time when the goal starts", verbose_name="Start date"
    )

    end_date = models.DateTimeField(
        help_text="Date and time when the goal ends", verbose_name="End date"
    )

    current_amount = models.PositiveIntegerField(
        help_text="The current amount including the unit (e.g. '500€')",
        verbose_name="Current Amount",
        default=0,
    )

    goal_amount = models.PositiveIntegerField(
        help_text="The goal amount including the unit (e.g. '1000€')",
        verbose_name="Goal Amount",
        default=0,
    )

    unit = models.CharField(
        help_text="Unit of the donation goal, e.g. '€'",
        verbose_name="Unit",
        max_length=64,
        default="€",
        null=True,
        blank=True,
    )

    call_to_action_text = models.CharField(
        help_text="Text for the call to action, e.g. 'Donate now!'",
        verbose_name="Call to Action Text",
        max_length=512,
        null=True,
        blank=True,
    )

    call_to_action_text_de_translation = models.CharField(
        help_text="German translation for text for the call to action, e.g. 'Jetzt spenden!'",
        verbose_name="Call to Action Text (German Translation)",
        max_length=512,
        null=True,
        blank=True,
    )

    call_to_action_link = models.CharField(
        help_text="Link for the call to action, e.g. 'https://climatehub.earth/300'",
        verbose_name="Call to Action Link",
        max_length=512,
        null=True,
        blank=True,
    )

    hub = models.ForeignKey(
        Hub,
        related_name="donationgoal_hub",
        help_text="Choose a hub if the donation goal should only be shown on one hub",
        verbose_name="Hub",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )

    twingle_project_id = models.CharField(
        help_text=(
            "Twingle project id (e.g. 'tw6a3547480226a'), shown in twingleMANAGER "
            "for the campaign project. When set, new recurring donations of that "
            "project are added to the current amount automatically. Leave empty "
            "to maintain the current amount by hand only. A Twingle project can "
            "be mapped to one goal only; clear it when the campaign ends."
        ),
        verbose_name="Twingle project id",
        max_length=64,
        blank=True,
        default="",
        db_default="",
    )

    twingle_unit_price = models.DecimalField(
        help_text=(
            "Price of one unit in € per month. A Twingle donation adds its monthly "
            "amount divided by this price, rounded down (e.g. at 7: 14 €/month "
            "adds 2, 10 €/month adds 1, 84 €/year adds 1)."
        ),
        verbose_name="Unit price (€ per month)",
        max_digits=8,
        decimal_places=2,
        default=Decimal("7.00"),
        db_default=Decimal("7.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )

    twingle_last_delivery_at = models.DateTimeField(
        help_text=(
            "Last validly signed Twingle delivery for this project, counted or not"
        ),
        verbose_name="Last Twingle delivery",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        help_text="Time when donation was created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when donation was updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    class Meta:
        app_label = "climateconnect_api"
        verbose_name = "DonationGoal"
        verbose_name_plural = "DonationGoals"
        ordering = ["-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["twingle_project_id"],
                condition=~Q(twingle_project_id=""),
                name="unique_donationgoal_twingle_project_id",
                violation_error_message=(
                    "This Twingle project is already mapped to another donation "
                    "goal. Remove the mapping there first."
                ),
            ),
            models.CheckConstraint(
                condition=Q(twingle_unit_price__gt=0),
                name="donationgoal_twingle_unit_price_positive",
                violation_error_message="The unit price must be greater than 0.",
            ),
        ]

    def __str__(self):
        return "DonationGoal %s" % (self.name)

    def clean(self):
        # Normalise before the unique constraint is validated, so surrounding
        # whitespace can't map the same Twingle project twice.
        self.twingle_project_id = (self.twingle_project_id or "").strip()

    def save(self, *args, **kwargs):
        self.twingle_project_id = (self.twingle_project_id or "").strip()
        super().save(*args, **kwargs)


class Donation(models.Model):
    user = models.ForeignKey(
        User,
        related_name="donation_user",
        verbose_name="User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    donor_name = models.CharField(
        help_text="Donor name",
        verbose_name="Donor Name",
        max_length=512,
        null=True,
        blank=True,
    )

    donation_amount = models.FloatField(
        help_text="Amount donated in €",
        verbose_name="Donation amount in €",
        default=0.0,
    )

    is_recurring = models.BooleanField(
        help_text="Check if the donation is recurring monthly",
        verbose_name="Donation recurring monthly",
        null=True,
        blank=True,
        default=False,
    )

    date_first_received = models.DateTimeField(
        help_text="Date and time when the donation was first received",
        verbose_name="Date first received",
    )

    date_cancelled = models.DateTimeField(
        help_text="Date and time when the donation was cancelled (only for recurring donations)",
        verbose_name="Date cancelled",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        help_text="Time when donation was created",
        verbose_name="Created At",
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        help_text="Time when donation was updated",
        verbose_name="Updated At",
        auto_now=True,
    )

    class Meta:
        app_label = "climateconnect_api"
        verbose_name = "Donation"
        verbose_name_plural = "Donations"
        ordering = ["-id"]

    def __str__(self):
        return "%s %s from %s (%s%s)" % (
            "One time donation: " if not self.is_recurring else "Regular donation: ",
            str(self.donation_amount) + "€",
            "" if not self.user else self.user.first_name + " " + self.user.last_name,
            self.date_first_received,
            ", cancelled " + str(self.date_cancelled) if self.date_cancelled else "",
        )
