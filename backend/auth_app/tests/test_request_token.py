import string
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from auth_app.models import LoginAuditLog, LoginToken

URL = reverse("auth-request-token")


def _make_user(email):
    return User.objects.create_user(username=email, email=email, password="testpass123")


def _make_token(user, email, seconds_ago=120):
    token = LoginToken(
        user=user,
        email=email,
        token_hash="a" * 64,
        session_key="b" * 64,
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    token.save()
    backdated = timezone.now() - timedelta(seconds=seconds_ago)
    LoginToken.objects.filter(pk=token.pk).update(created_at=backdated)
    return LoginToken.objects.get(pk=token.pk)


def _is_valid_session_key(sk):
    return len(sk) == 64 and all(c in string.hexdigits for c in sk)


@override_settings(RATELIMIT_ENABLE=False)
class RequestTokenViewTest(TestCase):
    @patch("auth_app.views.send_login_code_email")
    def test_valid_email_user_exists_no_previous_token(self, mock_task):
        user = _make_user("valid@example.com")
        response = self.client.post(
            URL, {"email": "valid@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        sk = response.json()["session_key"]
        self.assertTrue(_is_valid_session_key(sk))
        self.assertTrue(LoginToken.objects.filter(email="valid@example.com").exists())
        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        self.assertEqual(call_kwargs["user_id"], user.id)
        self.assertEqual(len(call_kwargs["code"]), 6)
        log = LoginAuditLog.objects.get(email="valid@example.com")
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.REQUESTED)

    @patch("auth_app.views.send_login_code_email")
    def test_valid_email_previous_token_old_returns_200_and_resent(self, mock_task):
        user = _make_user("resend@example.com")
        old_token = _make_token(user, "resend@example.com", seconds_ago=200)
        response = self.client.post(
            URL, {"email": "resend@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(_is_valid_session_key(response.json()["session_key"]))
        old_token.refresh_from_db()
        self.assertIsNotNone(old_token.used_at)
        log = LoginAuditLog.objects.filter(email="resend@example.com").latest(
            "created_at"
        )
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.RESENT)

    @patch("auth_app.views.send_login_code_email")
    def test_cooldown_recent_token_returns_429(self, mock_task):
        user = _make_user("cooldown@example.com")
        _make_token(user, "cooldown@example.com", seconds_ago=10)
        response = self.client.post(
            URL, {"email": "cooldown@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)
        self.assertEqual(
            LoginToken.objects.filter(email="cooldown@example.com").count(), 1
        )
        mock_task.delay.assert_not_called()

    @patch("auth_app.views.send_login_code_email")
    def test_cooldown_exactly_at_threshold_returns_200(self, mock_task):
        user = _make_user("cooldown_boundary@example.com")
        _make_token(user, "cooldown_boundary@example.com", seconds_ago=180)
        response = self.client.post(
            URL,
            {"email": "cooldown_boundary@example.com"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        mock_task.delay.assert_called_once()

    @patch("auth_app.views.send_login_code_email")
    def test_cooldown_within_threshold_returns_429(self, mock_task):
        user = _make_user("cooldown_within@example.com")
        _make_token(user, "cooldown_within@example.com", seconds_ago=90)
        response = self.client.post(
            URL,
            {"email": "cooldown_within@example.com"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)
        self.assertEqual(
            LoginToken.objects.filter(email="cooldown_within@example.com").count(), 1
        )
        mock_task.delay.assert_not_called()

    @patch("auth_app.views.send_login_code_email")
    def test_unknown_email_returns_200_no_token_no_email(self, mock_task):
        response = self.client.post(
            URL, {"email": "unknown@example.com"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(_is_valid_session_key(response.json()["session_key"]))
        self.assertFalse(
            LoginToken.objects.filter(email="unknown@example.com").exists()
        )
        mock_task.delay.assert_not_called()
        log = LoginAuditLog.objects.get(email="unknown@example.com")
        self.assertIsNone(log.user_id)
        self.assertEqual(log.outcome, LoginAuditLog.Outcome.REQUESTED)

    def test_missing_email_returns_400(self):
        response = self.client.post(URL, {}, content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_malformed_email_returns_400(self):
        response = self.client.post(
            URL, {"email": "notanemail"}, content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_per_email_ratelimit_returns_429(self):
        with patch("auth_app.views.is_ratelimited", return_value=True):
            response = self.client.post(
                URL, {"email": "rate@example.com"}, content_type="application/json"
            )
        self.assertEqual(response.status_code, 429)
        self.assertIn("Retry-After", response.headers)

    def test_per_ip_ratelimit_returns_429(self):
        call_count = 0

        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # First call is per-email (passes), second is per-IP (blocked)
            return call_count == 2

        with patch("auth_app.views.is_ratelimited", side_effect=side_effect):
            response = self.client.post(
                URL, {"email": "iprate@example.com"}, content_type="application/json"
            )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers.get("Retry-After"), "3600")
