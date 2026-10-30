"""Разовый инструмент: генерирует ключевую пару Ed25519 для подписи лицензий
портативной сборки.

Запускать РОВНО ОДИН РАЗ, на своей машине — повторный запуск создаст новую
пару и обесценит уже выданные клиентам license.key (они подписаны старым
ключом, публичный ключ в сборке будет уже другим).

`private_key.pem` не должен попасть НИ В ОДИН git-репозиторий и НИ В ОДНУ
сборку — только сюда, в эту папку, которую build-portable.ps1 никогда не
копирует (её нет в списке копируемых файлов). Потеря этого файла означает,
что новые лицензии выпустить будет нельзя — уже выданные продолжат работать,
это подпись, не онлайн-проверка.
"""

from __future__ import annotations

import base64
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

OUT_DIR = Path(__file__).resolve().parent
PRIVATE_KEY_PATH = OUT_DIR / "private_key.pem"


def main() -> None:
    if PRIVATE_KEY_PATH.exists():
        raise SystemExit(
            f"{PRIVATE_KEY_PATH} уже существует — keygen не перезаписывает существующий "
            "ключ, чтобы случайно не обесценить уже выданные лицензии. Удалите файл "
            "руками, если действительно хотите начать с чистого листа."
        )

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_raw = public_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )

    PRIVATE_KEY_PATH.write_bytes(private_bytes)

    print("Приватный ключ сохранён:", PRIVATE_KEY_PATH)
    print("Никогда не копируйте этот файл в сборку, в git или куда-либо ещё.")
    print()
    print("Публичный ключ — вставьте в backend/app/core/license.py, в PUBLIC_KEY_B64:")
    print()
    print(base64.b64encode(public_raw).decode())


if __name__ == "__main__":
    main()
