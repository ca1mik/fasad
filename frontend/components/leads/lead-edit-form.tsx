"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { readLeadAddress, readLeadDueDate } from "@/components/leads/lead-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { clientRequest } from "@/lib/client-api";
import { formatDateOnly } from "@/lib/format";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, labelFor } from "@/lib/labels";
import type { Lead, ProductionDirection } from "@/types/api";

type Props = {
  lead: Lead;
  directions: ProductionDirection[];
};

const FIELD = "block space-y-2 text-sm text-slate-700";
const LABEL = "text-xs uppercase tracking-[0.12em] text-slate-500";
const SELECT =
  "flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400";

/**
 * Правка сохранённой заявки прямо в её карточке.
 *
 * Заказчик: сохранённую заявку нельзя было тронуть вообще. Клиент отказался — а
 * заявка навсегда оставалась «новой» и висела в его карточке как расчёт,
 * который «ждёт ответа»; ошиблись в номере или сдвинули срок — переписать
 * нечем.
 *
 * Правка по кнопке, а не всегда: карточку заявки чаще читают (называют клиенту
 * номер, смотрят срок), чем меняют, и поля ввода на каждый чих мешают глазу —
 * тот же приём уже работает в карточке клиента.
 */
export function LeadEditForm({ lead, directions }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    lead_number: lead.lead_number ?? "",
    status: lead.status,
    direction_code: lead.direction?.code ?? "",
    due_date: readLeadDueDate(lead),
    address: readLeadAddress(lead.parsed_payload_json),
  });

  const mutation = useMutation({
    mutationFn: () =>
      clientRequest(`/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          lead_number: form.lead_number.trim(),
          status: form.status,
          // Пустое поле уходит как «убрать», а не как пустая строка: «пока не
          // решили» — рабочее состояние заявки, и снять ошибочно выбранное
          // направление менеджер должен уметь.
          direction_code: form.direction_code || null,
          due_date: form.due_date || null,
          address: form.address.trim() || null,
        }),
      }),
    onSuccess: () => {
      setError(null);
      setEditing(false);
      router.refresh();
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const address = readLeadAddress(lead.parsed_payload_json);
  const cardAddress = (lead.client?.address ?? "").trim();
  // Статус, которого нет в списке (заявка из старых данных, служебный «спам»),
  // всё равно должен быть в выборе: иначе список подставил бы первый пункт, и
  // сохранение поменяло бы статус, которого менеджер не трогал.
  const statusOptions = LEAD_STATUS_ORDER.includes(form.status)
    ? LEAD_STATUS_ORDER
    : [...LEAD_STATUS_ORDER, form.status];

  if (!editing) {
    return (
      <div className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className={LABEL}>Статус</dt>
            <dd className="mt-1">
              <StatusBadge kind="lead" value={lead.status} />
            </dd>
          </div>
          <Fact label="Номер заявки" value={lead.lead_number} empty="без номера" strong />
          <Fact
            label="Срок"
            value={formatDateOnly(readLeadDueDate(lead) || null)}
            empty="не назван"
          />
          <Fact label="Направление" value={lead.direction?.name} empty="не выбрано" />
          <div className="sm:col-span-2 xl:col-span-4">
            <dt className={LABEL}>Адрес доставки</dt>
            <dd className="mt-1 text-slate-700">{address || "не указан"}</dd>
            {/* Заказчик вводил адрес в заявке и не находил его в карточке
                клиента: заявка её не меняет. Раньше об этом нигде не
                говорилось, и выглядело так, будто адрес молча выбросили. */}
            {address && cardAddress && address !== cardAddress ? (
              <p className="mt-1 text-xs text-slate-500">
                Это адрес доставки по заявке. В карточке клиента другой адрес — «{cardAddress}», и
                заявка его не меняет.
              </p>
            ) : null}
            {address && !cardAddress ? (
              <p className="mt-1 text-xs text-slate-500">
                В карточке клиента адреса не было — он записан туда же при приёме заявки.
              </p>
            ) : null}
          </div>
        </dl>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Изменить заявку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className={FIELD}>
          <span className={LABEL}>Статус</span>
          <select
            className={SELECT}
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            {statusOptions.map((code) => (
              <option key={code} value={code}>
                {labelFor(LEAD_STATUS_LABELS, code)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Номер заявки</span>
          <Input
            className="num"
            value={form.lead_number}
            placeholder="44-03"
            onChange={(event) => setForm((prev) => ({ ...prev, lead_number: event.target.value }))}
          />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Срок</span>
          <Input
            type="date"
            className="num"
            value={form.due_date}
            onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
          />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Направление</span>
          <select
            className={SELECT}
            value={form.direction_code}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, direction_code: event.target.value }))
            }
          >
            <option value="">не выбрано</option>
            {directions.map((direction) => (
              <option key={direction.id} value={direction.code}>
                {direction.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2 xl:col-span-4">
          <label className={FIELD}>
            <span className={LABEL}>Адрес доставки</span>
            <Input
              value={form.address}
              placeholder="куда везти именно этот заказ"
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Адрес хранится в заявке: доставка бывает разовой, и адрес в карточке клиента от неё не
            меняется. Постоянный адрес правится в карточке клиента.
          </p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.lead_number.trim()}
        >
          {mutation.isPending ? "Сохранение..." : "Сохранить"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(false);
            setError(null);
            // Возврат к сохранённому: закрыли правку — на экране снова то, что
            // лежит в базе, а не брошенный черновик.
            setForm({
              lead_number: lead.lead_number ?? "",
              status: lead.status,
              direction_code: lead.direction?.code ?? "",
              due_date: readLeadDueDate(lead),
              address: readLeadAddress(lead.parsed_payload_json),
            });
          }}
        >
          Отмена
        </Button>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  empty,
  strong,
}: {
  label: string;
  value?: string | null;
  empty?: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className={LABEL}>{label}</dt>
      <dd className={strong ? "mt-1 num font-medium text-slate-900" : "mt-1 text-slate-700"}>
        {value || empty || "—"}
      </dd>
    </div>
  );
}
