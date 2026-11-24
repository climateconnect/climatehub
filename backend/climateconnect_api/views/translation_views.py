from django.utils.translation import get_language
from climateconnect_api.utility.translation import translate_text
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError


class TranslateTextView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        required_params = ["text", "target_language"]
        for param in required_params:
            if param not in request.data:
                raise ValidationError("Required parameter missing: " + param)
        translated_object = translate_text(
            request.data["text"], get_language(), request.data["target_language"]
        )
        return Response({"result": translated_object}, status=status.HTTP_200_OK)


class TranslateManyTextsView(APIView):
    permission_classes = (AllowAny,)

    def post(self, request):
        required_params = ["texts", "target_language"]
        for param in required_params:
            if param not in request.data:
                raise ValidationError("Required parameter missing: " + param)
        # Keys whose texts are HTML (e.g. a rich-text description). DeepL then
        # translates only the text and leaves tags and attributes untouched.
        html_keys = request.data.get("html_keys") or []
        translations = {}
        for key in request.data["texts"].keys():
            is_html = key in html_keys
            if isinstance(request.data["texts"][key], list):
                translations[key] = request.data["texts"][key]
                for i in range(len(request.data["texts"][key])):
                    translations[key][i] = translate_text(
                        request.data["texts"][key][i],
                        request.LANGUAGE_CODE,
                        request.data["target_language"],
                        is_html=is_html,
                    )
            else:
                translations[key] = translate_text(
                    request.data["texts"][key],
                    request.LANGUAGE_CODE,
                    request.data["target_language"],
                    is_html=is_html,
                )
        return Response({"translations": translations}, status=status.HTTP_200_OK)
