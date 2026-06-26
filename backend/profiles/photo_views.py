import io
import uuid

from django.core.files.base import ContentFile
from rest_framework import status as http_status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from PIL import Image, ImageOps

try:  # ensures the AVIF codec is registered on Pillow builds without native support
    import pillow_avif  # noqa: F401
except Exception:  # pragma: no cover
    pass

from profiles.models import Photo

MAX_DIMENSION = 1600   # cap the longest side; keeps files small
AVIF_QUALITY = 55


def _to_avif(uploaded) -> ContentFile:
    """Decode any uploaded image and re-encode it as a right-sized AVIF."""
    img = Image.open(uploaded)
    img = ImageOps.exif_transpose(img)   # honour camera orientation
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    buf = io.BytesIO()
    img.save(buf, format="AVIF", quality=AVIF_QUALITY)
    return ContentFile(buf.getvalue(), name=f"{uuid.uuid4().hex}.avif")


def _to_jpeg(uploaded) -> ContentFile:
    """Decode any uploaded image and re-encode it as a right-sized JPEG —
    used where Telegram must deliver the file (it doesn't accept AVIF)."""
    img = Image.open(uploaded)
    img = ImageOps.exif_transpose(img)
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return ContentFile(buf.getvalue(), name=f"{uuid.uuid4().hex}.jpg")


def _payload(photo: Photo) -> dict:
    # relative URL → same origin as the SPA (avoids http/https proxy mixups)
    return {"id": photo.id, "url": photo.image.url}


@api_view(["GET", "POST"])
def my_photos(request):
    """List the caller's photos, or upload one more (AVIF, max 5)."""
    user = request.user

    if request.method == "GET":
        return Response({"photos": [_payload(p) for p in user.photos.all()]})

    upload = request.FILES.get("image")
    if upload is None:
        return Response({"detail": "Rasm yuborilmadi."}, status=http_status.HTTP_400_BAD_REQUEST)
    if user.photos.count() >= Photo.MAX_PER_USER:
        return Response(
            {"detail": f"Eng ko‘pi {Photo.MAX_PER_USER} ta rasm."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    try:
        avif = _to_avif(upload)
    except Exception:
        return Response({"detail": "Rasmni o‘qib bo‘lmadi."}, status=http_status.HTTP_400_BAD_REQUEST)

    photo = Photo.objects.create(user=user, image=avif, order=user.photos.count())
    return Response(_payload(photo), status=http_status.HTTP_201_CREATED)


@api_view(["DELETE"])
def my_photo(request, photo_id: int):
    """Delete one of the caller's photos."""
    try:
        photo = request.user.photos.get(pk=photo_id)
    except Photo.DoesNotExist:
        return Response(status=http_status.HTTP_404_NOT_FOUND)
    photo.image.delete(save=False)   # remove the file from storage too
    photo.delete()
    return Response(status=http_status.HTTP_204_NO_CONTENT)
