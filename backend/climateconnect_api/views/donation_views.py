from climateconnect_api.models.user import UserProfile
from rest_framework.views import APIView
from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from climateconnect_api.serializers.user import (
    DonorProfileSerializer,
)
import datetime
from datetime import timezone
from django.db.models import Q

from climateconnect_api.models import DonationGoal, Donation
from climateconnect_api.serializers.donation import DonationGoalSerializer


class GetDonationGoalProgress(APIView):
    """
    Returns single donation goal progress.
    Deprecated
    Use getDonationGoalsProgresses instead
    """

    permission_classes = [AllowAny]

    def get(self, request):
        now = datetime.datetime.now(timezone.utc)
        try:
            goal = DonationGoal.objects.get(start_date__lte=now, end_date__gte=now)
        except DonationGoal.DoesNotExist:
            goal = None
        serializer = DonationGoalSerializer(goal, many=False)
        return Response(serializer.data)


class GetDonationGoalsProgresses(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        now = datetime.datetime.now(timezone.utc)
        goals = DonationGoal.objects.filter(start_date__lte=now, end_date__gte=now)
        serializer = DonationGoalSerializer(goals, many=True)
        return Response(serializer.data)


class GetDonorsWithBadges(ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = DonorProfileSerializer

    def get_queryset(self):
        today = datetime.date.today()
        one_month_ago = today - datetime.timedelta(days=30)
        donors_with_relevant_donations = (
            Donation.objects.filter(
                Q(Q(is_recurring=True) | Q(date_first_received__gte=one_month_ago)),
                donation_amount__gte=5,
                date_cancelled=None,
                user__isnull=False,
            )
            .order_by()
            .values("user")
            .distinct()
        )
        relevant_user_profiles = []
        for donor in donors_with_relevant_donations:
            try:
                user_profile = UserProfile.objects.get(user_id=donor["user"])
                relevant_user_profiles.append(user_profile)
            except UserProfile.DoesNotExist:
                return Response(
                    data={
                        "message": "We ran into some issues processing your request."
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        return relevant_user_profiles
