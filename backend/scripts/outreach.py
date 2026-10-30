"""Send the cold-outreach campaign one personalised letter at a time.

Run from ``backend/``. The mailbox comes from an email ChannelAccount that is
already configured in the admin UI, so no credential is passed on the command
line or kept in a second place.

    python scripts/outreach.py --channel email-main --list
    python scripts/outreach.py --channel email-main                 # dry run
    python scripts/outreach.py --channel email-main --send --limit 10
    python scripts/outreach.py --replied vokrug
    python scripts/outreach.py --opt-out zakaz@example.ru

Sending is never the default: without ``--send`` the script prints what it would
do and touches nothing.
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from pathlib import Path

from sqlalchemy import select

from app.core.exceptions import AppError
from app.db.session import SessionLocal
from app.modules.messaging.channel_config import get_secret, load_email_config
from app.modules.messaging.email_transport import send_message
from app.modules.messaging.models import ChannelAccount
from app.modules.messaging.outreach import (
    Prospect,
    load_prospects,
    load_state,
    render_body,
    save_state,
    select_batch,
)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DATA = SCRIPT_DIR / "outreach_prospects.json"
DEFAULT_STATE = SCRIPT_DIR / "outreach_state.json"

SIGNATURE_HELP = (
    "Подпись обязана содержать реквизиты отправителя (ИП/ООО, ИНН) и то, откуда взят адрес: "
    "без них деловое письмо выглядит как анонимная реклама. Задайте переменную окружения "
    "OUTREACH_SIGNATURE или передайте --signature-file."
)


def _signature(args: argparse.Namespace) -> str:
    if args.signature_file:
        path = Path(args.signature_file)
        if not path.exists():
            raise AppError(f"Файл подписи не найден: {path}")
        return path.read_text(encoding="utf-8").strip()
    signature = os.environ.get("OUTREACH_SIGNATURE", "").strip()
    if not signature:
        raise AppError(SIGNATURE_HELP)
    return signature


def _load_channel(session, code: str) -> ChannelAccount:
    account = session.execute(
        select(ChannelAccount).where(ChannelAccount.code == code)
    ).scalar_one_or_none()
    if account is None:
        raise AppError(
            f"Канал «{code}» не найден. Заведите почтовый ящик на /admin/channels "
            "и укажите его код через --channel."
        )
    if not account.is_active:
        raise AppError(f"Канал «{code}» выключен — включите его в админке.")
    return account


def _print_plan(batch: list[Prospect], signature: str, *, total_pending: int) -> None:
    for number, prospect in enumerate(batch, start=1):
        body = render_body(prospect, signature=signature)
        print(f"\n{'=' * 72}")
        print(f"[{number}/{len(batch)}] {prospect.company} — {prospect.city}")
        print(f"Кому:  {prospect.email}")
        print(f"Тема:  {prospect.subject}")
        if prospect.note:
            print(f"Заметка: {prospect.note}")
        print(f"{'-' * 72}\n{body}")
    print(f"\n{'=' * 72}")
    print(f"В партии: {len(batch)}. Ждут очереди всего: {total_pending}.")


def _send_batch(
    batch: list[Prospect],
    *,
    account: ChannelAccount,
    signature: str,
    state,
    state_path: Path,
    pause: int,
) -> int:
    config = load_email_config(account)
    password = get_secret(account, "smtp_password")
    if not config.smtp.host:
        raise AppError(f"У канала «{account.code}» не заполнен SMTP-хост.")

    sent = 0
    for number, prospect in enumerate(batch, start=1):
        body = render_body(prospect, signature=signature)
        try:
            message_id = send_message(
                config,
                password,
                to_email=prospect.email,
                subject=prospect.subject,
                body_text=body,
            )
        except Exception as exc:  # noqa: BLE001 - one bad address must not stop the campaign
            print(f"[{number}/{len(batch)}] {prospect.company}: ОШИБКА — {exc}", flush=True)
            continue

        state.record(prospect, message_id=message_id)
        # Save after every letter: a crash mid-run must not resend what already went out.
        save_state(state_path, state)
        sent += 1
        print(
            f"[{number}/{len(batch)}] {prospect.company} → {prospect.email}: отправлено", flush=True
        )

        if number < len(batch) and pause > 0:
            time.sleep(random.uniform(pause * 0.6, pause * 1.4))
    return sent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Персональная рассылка по списку компаний")
    parser.add_argument("--channel", help="Код почтового канала из /admin/channels")
    parser.add_argument("--data", default=str(DEFAULT_DATA), help="Файл со списком компаний")
    parser.add_argument("--state", default=str(DEFAULT_STATE), help="Журнал отправок")
    parser.add_argument("--limit", type=int, default=10, help="Сколько писем в этой партии")
    parser.add_argument("--daily-limit", type=int, default=25, help="Потолок писем в сутки")
    parser.add_argument("--pause", type=int, default=150, help="Пауза между письмами, секунды")
    parser.add_argument("--signature-file", help="Файл с подписью и реквизитами")
    parser.add_argument("--send", action="store_true", help="Действительно отправить письма")
    parser.add_argument("--list", action="store_true", help="Показать состояние списка и выйти")
    parser.add_argument("--replied", metavar="CODE", help="Отметить, что компания ответила")
    parser.add_argument("--opt-out", metavar="EMAIL", help="Больше не писать на этот адрес")
    args = parser.parse_args(argv)

    data_path = Path(args.data)
    state_path = Path(args.state)
    prospects = load_prospects(data_path)
    state = load_state(state_path)

    if args.replied:
        state.replied.add(args.replied)
        save_state(state_path, state)
        print(f"«{args.replied}» отмечена как ответившая — писем больше не уйдёт.")
        return 0

    if args.opt_out:
        state.opted_out.add(args.opt_out.strip().lower())
        save_state(state_path, state)
        print(f"{args.opt_out} внесён в отказы.")
        return 0

    pending = select_batch(prospects, state, limit=len(prospects))
    if args.list:
        print(f"Всего компаний: {len(prospects)}")
        print(f"Отправлено:     {sum(1 for p in prospects if state.was_sent(p.code))}")
        print(f"Ответили:       {len(state.replied)}")
        print(f"Отказались:     {len(state.opted_out)}")
        print(f"Ждут отправки:  {len(pending)}")
        print(f"Ушло сегодня:   {state.sent_today()}")
        return 0

    signature = _signature(args)
    batch = select_batch(prospects, state, limit=args.limit, daily_limit=args.daily_limit)

    if not batch:
        print("Отправлять некому: список исчерпан или выбран суточный лимит.")
        return 0

    if not args.send:
        _print_plan(batch, signature, total_pending=len(pending))
        print("Это черновой прогон. Чтобы отправить, добавьте --send.")
        return 0

    if not args.channel:
        raise AppError("Для отправки укажите --channel — код почтового канала.")

    with SessionLocal() as session:
        account = _load_channel(session, args.channel)
        sent = _send_batch(
            batch,
            account=account,
            signature=signature,
            state=state,
            state_path=state_path,
            pause=args.pause,
        )

    print(f"\nОтправлено писем: {sent} из {len(batch)}.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AppError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        sys.exit(1)
