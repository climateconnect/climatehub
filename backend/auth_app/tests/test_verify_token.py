import hashlib
import threading
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from knox.models import AuthToken

from auth_app.models import LoginAuditLog, LoginToken
from climateconnect_api.models import UserProfile

URL = reverse("auth-verify-token")
RAW_CODE = "123456"
TOKEN_HASH = hashlib.sha256(RAW_CODE.encode()).hexdigest()
WRONG_CODE = "000000"

_counter = 0


def _make_user(email, verified=True):
    global _counter
    _counter += 1
    user = User.objects.create_user(username=email, email=email, password="unused-pass")
    UserProfile.objects.create(
        user=user,
        url_slug="slug-{}".format(_counter),
        is_profile_verified=verified,
    )
    return user


def _make_token(user, email, expired=False, used=False, attempt_count=0):
    if expired:
        expires_at = timezone.now() - timedelta(minutes=1)
    else:
        expires_at = timezone.now() + timedelta(minutes=15)
    used_at = timezone.now() if used else None
    return LoginToken.objects.create(
        user=user,
        email=email,
        token_hash=TOKEN_HASH,
        session_key="a" * 64,
        expires_at=expires_at,
        used_at=used_at,
        attempt_count=attempt_count,
    )


def _post(client, session_key, code):
    return client.post(
        URL,
        {"session_key": session_key, "code": code},
        content_type="application/json",
    )


@override_settings(RATELIMIT_ENABLE=False)
class VerifyTokenViewTest(TestCase):
    def test_success_returns_token_and_user(self):
        user = _make_user("ok@example.com")
        token = _make_token(user, "ok@example.com")
        resp = _post(self.client, token.session_key, RAW_CODE)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("token", data)
        self.assertIn("expiry", data)
        self.assertIn("user", data)
        self.assertTrue(data["token"])
        self.assertTrue(AuthToken.objects.filter(user=user).exists())
        token.refresh_from_db()
        self.assertIsNotNone(token.used_at)
        log = LoginAuditLog.objects.get(
            email="ok@example.com", outcome=LoginAuditLog.Outcome.VERIFIED
        )
        self.assertIsNotNone(log)

    def test_code_with_surrounding_whitespace_returns_token_and_user(self):
        user = _make_user("ws@example.com")
        token = _make_token(user, "ws@example.com")
        resp = _post(self.client, token.session_key, "  {} \n".format(RAW_CODE))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(AuthToken.objects.filter(user=user).exists())

    def test_expired_token_returns_401_expired(self):
        user = _make_user("exp@example.com")
        token = _make_token(user, "exp@example.com", expired=True)
        resp = _post(self.client, token.session_key, RAW_CODE)
        self.assertEqual(resp.status_code, 401)
        token.refresh_from_db()
        self.assertIsNone(token.used_at)
        self.assertEqual(
            LoginAuditLog.objects.get(email="exp@example.com").outcome,
            LoginAuditLog.Outcome.EXPIRED,
        )

    def test_already_used_token_returns_401(self):
        user = _make_user("used@example.com")
        token = _make_token(user, "used@example.com", used=True)
        resp = _post(self.client, token.session_key, RAW_CODE)
        self.assertEqual(resp.status_code, 401)
        self.assertFalse(AuthToken.objects.filter(user=user).exists())
        self.assertEqual(
            LoginAuditLog.objects.get(email="used@example.com").outcome,
            LoginAuditLog.Outcome.FAILED,
        )

    def test_attempt_count_5_returns_401_exhausted(self):
        user = _make_user("exhaust@example.com")
        token = _make_token(user, "exhaust@example.com", attempt_count=5)
        resp = _post(self.client, token.session_key, RAW_CODE)
        self.assertEqual(resp.status_code, 401)
        token.refresh_from_db()
        self.assertEqual(token.attempt_count, 5)  # not incremented further
        self.assertEqual(
            LoginAuditLog.objects.get(email="exhaust@example.com").outcome,
            LoginAuditLog.Outcome.EXHAUSTED,
        )

    def test_wrong_code_increments_attempt_count(self):
        user = _make_user("wrong@example.com")
        token = _make_token(user, "wrong@example.com")
        resp = _post(self.client, token.session_key, WRONG_CODE)
        self.assertEqual(resp.status_code, 401)
        self.assertIn("4 attempts remaining", resp.json()["detail"])
        token.refresh_from_db()
        self.assertEqual(token.attempt_count, 1)
        self.assertEqual(
            LoginAuditLog.objects.get(email="wrong@example.com").outcome,
            LoginAuditLog.Outcome.FAILED,
        )

    def test_wrong_code_on_attempt_4_exhausts_token(self):
        user = _make_user("exhaust2@example.com")
        token = _make_token(user, "exhaust2@example.com", attempt_count=4)
        resp = _post(self.client, token.session_key, WRONG_CODE)
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Too many failed attempts", resp.json()["detail"])
        token.refresh_from_db()
        self.assertEqual(token.attempt_count, 5)
        self.assertEqual(
            LoginAuditLog.objects.get(email="exhaust2@example.com").outcome,
            LoginAuditLog.Outcome.EXHAUSTED,
        )

    def test_unknown_session_key_returns_401(self):
        resp = _post(self.client, "z" * 64, RAW_CODE)
        self.assertEqual(resp.status_code, 401)
        log = LoginAuditLog.objects.filter(outcome=LoginAuditLog.Outcome.FAILED).first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.user_id)

    def test_missing_session_key_returns_400(self):
        resp = self.client.post(
            URL, {"code": RAW_CODE}, content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_missing_code_returns_400(self):
        resp = self.client.post(
            URL, {"session_key": "a" * 64}, content_type="application/json"
        )
        self.assertEqual(resp.status_code, 400)

    def test_new_user_gets_verified_on_success(self):
        user = _make_user("newuser@example.com", verified=False)
        token = _make_token(user, "newuser@example.com")
        resp = _post(self.client, token.session_key, RAW_CODE)
        self.assertEqual(resp.status_code, 200)
        profile = UserProfile.objects.get(user=user)
        profile.refresh_from_db()
        self.assertTrue(profile.is_profile_verified)
        self.assertTrue(AuthToken.objects.filter(user=user).exists())

    pass  # concurrency test lives in VerifyTokenConcurrencyTest below


@override_settings(RATELIMIT_ENABLE=False)
class VerifyTokenConcurrencyTest(TransactionTestCase):
    """
    TransactionTestCase so that DB writes are committed and visible to threads.
    TestCase wraps every test in a transaction, making committed rows invisible
    across threads — causing both requests to see "session not found".
    """

    def test_concurrent_requests_only_one_succeeds(self):
        user = _make_user("race@example.com")
        token = _make_token(user, "race@example.com")
        results = []

        def do_request():
            from django.test import Client

            c = Client()
            r = c.post(
                URL,
                {"session_key": token.session_key, "code": RAW_CODE},
                content_type="application/json",
            )
            results.append(r.status_code)

        t1 = threading.Thread(target=do_request)
        t2 = threading.Thread(target=do_request)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        self.assertEqual(sorted(results), [200, 401])
        self.assertEqual(AuthToken.objects.filter(user=user).count(), 1)
