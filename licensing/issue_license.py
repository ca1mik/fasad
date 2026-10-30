"""Выпускает license.key для одного отпечатка компьютера клиента.

Использование:

    python issue_license.py --fingerprint XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX \\
        --client "ООО Ромашка" [--expires 2027-01-01]

Отпечаток берётся из сообщения об отказе на экране клиента при первом запуске
start.bat, либо из scripts/portable/show-fingerprint.bat. Приватный ключ
читается из private_key.pem рядом с этим файлом (см. keygen.py) — без него
подписать лицензию нельзя, это и есть весь смысл защиты.

Результат — licenses/<client>-license.key. Именно этот файл отправляется
клиенту с инструкцией: положить рядом с backend/.env под именем license.key
и перезапустить start.bat.
"""

from __future__ import annotations

import argparse
import base64
import json
import re
from datetime import UTC, datetime
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

HERE = Path(__file__).resolve().parent
DEFAULT_PRIVATE_KEY = HERE / "private_key.pem"

_SAFE_NAME = re.compile(r"[^\w.-]+", re.UNICODE)


def _safe_filename(name: str) -> str:
    return _SAFE_NAME.sub("_", name.strip()) or "client"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--fingerprint", required=True, help="Отпечаток компьютера клиента")
    parser.add_argument("--client", required=True, help="Название клиента — для своей истории, в проверку не входит")
    parser.add_argument("--expires", default=None, help="YYYY-MM-DD; не задано — лицензия бессрочная")
    parser.add_argument("--private-key", default=str(DEFAULT_PRIVATE_KEY))
    parser.add_argument("--out", default=None, help="Путь к файлу результата; по умолчанию licenses/<client>-license.key")
    args = parser.parse_args()

    key_path = Path(args.private_key)
    if not key_path.exists():
        raise SystemExit(f"Не найден приватный ключ: {key_path}. Сначала запустите keygen.py.")

    private_key = serialization.load_pem_private_key(key_path.read_bytes(), password=None)
    if not isinstance(private_key, Ed25519PrivateKey):
        raise SystemExit(f"{key_path} — не ключ Ed25519. Пересоздайте его через keygen.py.")

    fingerprint = args.fingerprint.strip().upper()
    if args.expires:
        try:
            datetime.strptime(args.expires, "%Y-%m-%d")
        except ValueError:
            raise SystemExit("--expires должен быть в формате YYYY-MM-DD") from None

    body = {
        "fingerprint": fingerprint,
        "issued_to": args.client,
        "issued_at": datetime.now(UTC).date().isoformat(),
        "expires_at": args.expires,
    }
    # sort_keys=True — тот же канонический вид, что и на стороне проверки
    # (app/core/license.py::_canonical_body). Разойдись порядок ключей —
    # подпись бы не сошлась ни на одном честно выданном файле.
    message = json.dumps(body, sort_keys=True, ensure_ascii=False).encode("utf-8")
    signature = private_key.sign(message)
    payload = {**body, "signature": base64.b64encode(signature).decode()}

    out_dir = HERE / "licenses"
    out_dir.mkdir(exist_ok=True)
    out_path = Path(args.out) if args.out else out_dir / f"{_safe_filename(args.client)}-license.key"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Готово:", out_path)
    print(f"Клиент: {args.client}  Отпечаток: {fingerprint}  Истекает: {args.expires or 'никогда'}")
    print()
    print("Отправьте этот файл клиенту. Ему нужно:")
    print("  1. переименовать его в license.key,")
    print("  2. положить рядом с backend\\.env внутри своей папки fasad-portable,")
    print("  3. перезапустить start.bat.")


if __name__ == "__main__":
    main()
