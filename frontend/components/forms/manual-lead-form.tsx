"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, FilePlus2, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import {
  createLeadPartRow,
  isRowFilled,
  LeadPartsTable,
  leadPartsTotals,
  rowAmount,
  rowArea,
  rowQuantity,
  rowUnit,
  rowUnitPrice,
  type LeadPartRow,
} from "@/components/forms/lead-parts-table";
import { SpreadsheetDropZone } from "@/components/forms/spreadsheet-drop-zone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NumberInput } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";
import { formatDateOnly, parseSizeLines, toDateInputValue } from "@/lib/format";
import { invalidPartQuantity, MAX_PART_UNITS } from "@/lib/part-quantity";
import { cn } from "@/lib/utils";
import type {
  Client,
  Envelope,
  Lead,
  PaymentMethod,
  PriceItem,
  ProductionDirection,
  ReferenceValues,
} from "@/types/api";

type Props = {
  title?: string;
  description?: string;
  compact?: boolean;
  /** Справочник цен для калькулятора в таблице. Пустой — считать нечем. */
  priceItems?: PriceItem[];
  /** Цвета и фрезеровки, которые студия уже писала, — для поиска в таблице. */
  referenceValues?: ReferenceValues;
  /**
   * Производственные направления: «Эмаль», «ПВХ», «Шпон».
   *
   * `code` — код направления, тот же, что принимает приём заявки в
   * `direction_code`. `kind` — тип работ прайса того же направления: под ним
   * заводится номенклатура из артикулов, набранных в этой заявке руками.
   */
  priceKinds?: { code: string; label: string; kind?: string }[];
  /** Отдаёт наружу заполненные строки, чтобы раскрой на этой же странице
      разложил именно их — заказчик просил «из этой же таблицы уже раскрой». */
  onRowsChange?: (rows: LeadPartRow[]) => void;
  /**
   * Номер, который получит заявка, если поле оставить пустым.
   *
   * Заказчик: «чтобы дважды не заносили предыдущие номера» — менеджер
   * подглядывал последний номер в списке заявок и прибавлял единицу руками.
   * Подсказка того же значения, что реально проставит сервер (см.
   * `GET /leads/next-number`), избавляет от этого подглядывания. Само поле
   * остаётся пустым — вписывать номер руками по-прежнему можно.
   */
  nextNumberHint?: string | null;
  /**
   * Способы оплаты — для поля «Оплата при создании заказа».
   *
   * Заказчик: «оплата при создании заказа сделать и отметки по суммам,
   * которые были введены». Платёж применяется только вместе с кнопкой
   * «Создать заказ»: у «Только заявки» заказа ещё нет, оплатить нечего.
   */
  paymentMethods?: PaymentMethod[];
};

const channelOptions = [
  { code: "manual_manager_input", name: "Ручной ввод менеджера" },
  { code: "website_form", name: "Форма сайта" },
  { code: "email", name: "Почта" },
  { code: "telegram_bot", name: "Telegram" },
  { code: "whatsapp", name: "WhatsApp" },
];

// С одного символа в подсказку попадает пол-базы, и она только мешает печатать.
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_LIMIT = 8;
// Менеджер печатает быстро: без паузы на каждую букву уходил бы запрос.
const SUGGEST_DEBOUNCE_MS = 250;

/** Строка подсказки: чем клиент отличается от однофамильца. */
function suggestionHint(item: Client) {
  return [item.organization, item.phone, item.email].filter(Boolean).join(" · ");
}

export function ManualLeadForm({
  title = "Новая заявка",
  description = "Заполни только то, что реально сказал клиент. Всё лишнее можно добавить позже.",
  compact = false,
  priceItems = [],
  referenceValues,
  priceKinds = [],
  onRowsChange,
  nextNumberHint,
  paymentMethods = [],
}: Props) {
  const router = useRouter();
  const [sourceChannel, setSourceChannel] = useState("manual_manager_input");
  // Производственное направление заявки: эмаль, ПВХ или шпон. От него зависит
  // буква в номере заказа и все отборы «по направлению». Раньше этот селект
  // писал в заявку только тип работ, а само направление не проставлялось
  // никогда — списки и отчёты по направлениям выходили пустыми.
  const [directionCode, setDirectionCode] = useState("");
  // Свой номер заявки: студия ведёт нумерацию по своим правилам. Пусто —
  // система поставит следующий по порядку, как было.
  const [leadNumber, setLeadNumber] = useState("");
  const [dueDays, setDueDays] = useState("");
  // Срок конкретной датой — заказчик: «сроки вписать чтобы можно было ставить,
  // ориентир даты изготовления». Дни остаются: так срок называют по телефону
  // («этот заказ 14 дней»), но если клиент назвал точный день, дату проще
  // поставить напрямую, а не подбирать число дней до неё.
  const [dueDateManual, setDueDateManual] = useState("");
  const [clientName, setClientName] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  // Адрес подставлен из карточки, а не набран руками: показываем подпись, чтобы
  // менеджер видел, что это не он его сейчас вписал.
  const [addressFromCard, setAddressFromCard] = useState(false);
  // Клиент, выбранный из базы. Пока он выбран, заявка должна лечь на него,
  // а не завести очередного двойника «Агат-Сервис» / «агат сервис».
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestTerm, setSuggestTerm] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const suggestBoxRef = useRef<HTMLDivElement>(null);
  // Позиции заявки — та же таблица, что студия печатает на бумаге. Раскрой у
  // фасадов всегда индивидуальный, типовых изделий не бывает, поэтому менеджер
  // заносит размеры сам, строка за строкой.
  const [rows, setRows] = useState<LeadPartRow[]>(() => [createLeadPartRow()]);
  // Вставка списком осталась: размеры часто приходят строками в письме, и
  // перебивать их по одной ячейке — лишняя работа.
  const [bulkInput, setBulkInput] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  /**
   * Какую кнопку нажали: просто заявка, заявка + сразу раскрой, или заявка +
   * сразу заказ («Создать заказ» одним действием — заказчик просил убрать
   * лишний экран: раньше заказ заводился только вторым отдельным кликом уже
   * на карточке созданной заявки).
   */
  const [submitMode, setSubmitMode] = useState<"lead" | "cutting" | "order">("lead");
  // Оплата при создании заказа — необязательная, применяется только вместе с
  // «Создать заказ»: см. onSuccess мутации ниже.
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentMethod, setInitialPaymentMethod] = useState(paymentMethods[0]?.code ?? "cash");

  const totals = useMemo(() => leadPartsTotals(rows, priceItems), [rows, priceItems]);

  /**
   * Срок из числа дней.
   *
   * Заказчик называет срок днями («этот заказ 14 дней»), а хранится он датой:
   * «14 дней» без точки отсчёта нечем проверить, а дату говорят клиенту. Пока
   * поле пустое, дата не считается — тогда заявка уезжает без срока, как и до
   * появления этого поля.
   */
  const dueDate = useMemo(() => {
    // Дата, вписанная напрямую, главнее прикидки по дням: клиент назвал точный
    // день — не подбирать же под него число дней от сегодня.
    if (dueDateManual) {
      return dueDateManual;
    }
    const count = Number(dueDays.replace(",", "."));
    if (!dueDays.trim() || !Number.isFinite(count) || count < 0) {
      return null;
    }
    const target = new Date();
    target.setDate(target.getDate() + Math.round(count));
    return toDateInputValue(target);
  }, [dueDays, dueDateManual]);
  const filledRows = useMemo(() => rows.filter(isRowFilled), [rows]);
  const invalidQuantity = rows.some((row) => invalidPartQuantity(row.quantity));
  const tooManyParts =
    totals.quantity > MAX_PART_UNITS || rows.some((row) => rowQuantity(row) > MAX_PART_UNITS);
  const partsError = invalidQuantity
    ? "Количество деталей должно быть целым числом больше нуля"
    : tooManyParts
      ? `В одной заявке можно указать не больше ${MAX_PART_UNITS} деталей`
      : null;
  /**
   * Строки, которые обязаны уехать на сервер.
   *
   * Кроме заполненных размерами — те, где менеджер набрал артикул, цвет или
   * фрезеровку, но размеры ещё не внёс. Такая строка не деталь и в раскрой не
   * пойдёт, но набранное в ней терять нельзя: заказчик просила, чтобы артикул
   * запоминался («вручную прописываю артикул 128, и он должен сохраниться»), а
   * раньше строка без размеров выбрасывалась целиком — вместе с номером и
   * ценой, которую уже назвали клиенту.
   */
  const rowsToSend = useMemo(
    () =>
      rows.filter(
        (row) =>
          isRowFilled(row) ||
          [row.articleText, row.color, row.milling].some((field) => field.trim()),
      ),
    [rows],
  );
  const parsedBulk = useMemo(() => parseSizeLines(bulkInput), [bulkInput]);
  // Справочник направлений берём из базы: заказчик заводит свои направления
  // прямо в админке, и в приёме заявки они должны появляться сами. Список из
  // `/price-book/options` остаётся запасным — он зашит в код и нужен, пока
  // запрос не вернулся или если он не прошёл.
  const directionsQuery = useQuery({
    queryKey: ["production-directions"],
    staleTime: 5 * 60_000,
    queryFn: () =>
      clientRequest<Envelope<ProductionDirection[]>>("/directions?only_active=true"),
  });

  const directionOptions = useMemo(() => {
    // Тип работ прайса приходит только со вторым списком: у направления,
    // которого в прайсе нет, типа не будет — артикул уйдёт без него, это лучше,
    // чем приписать его чужому виду обработки.
    const kindByCode = new Map(priceKinds.map((item) => [item.code, item.kind ?? ""]));
    const loaded = directionsQuery.data?.data ?? [];
    if (loaded.length) {
      return loaded.map((item) => ({
        code: item.code,
        label: item.name,
        kind: kindByCode.get(item.code) ?? "",
      }));
    }
    return priceKinds.map((item) => ({
      code: item.code,
      label: item.label,
      kind: item.kind ?? "",
    }));
  }, [directionsQuery.data, priceKinds]);

  const directionKind = useMemo(
    () => directionOptions.find((item) => item.code === directionCode)?.kind ?? "",
    [directionOptions, directionCode],
  );

  function applyRows(next: LeadPartRow[]) {
    setRows(next);
    onRowsChange?.(next.filter(isRowFilled));
  }

  /** Дописывает разобранные строки к таблице, не затирая уже набранное. */
  function appendRows(incoming: LeadPartRow[]) {
    if (!incoming.length) return;
    // Выбрасываем только совсем пустую строку-заготовку. По `isRowFilled`
    // отсеивалась и та, где менеджер уже вписал цвет с фрезеровкой, но не
    // успел набрать размеры, — набранное пропадало без предупреждения.
    const kept = rows.filter((row) =>
      [row.length, row.width, row.thickness, row.milling, row.color, row.articleText,
       row.customPrice].some((field) => field.trim()),
    );
    // Пустая строка в конце: после вставки списком и загрузки бланка менеджер
    // почти всегда дописывает ещё пару позиций руками. Сама таблица её больше
    // не подставляет — она добавляет строку только когда последняя стала
    // заполненной, а после вставки та заполнена сразу.
    applyRows([...kept, ...incoming, createLeadPartRow()]);
  }

  useEffect(() => {
    const timer = setTimeout(() => setSuggestTerm(clientName.trim()), SUGGEST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [clientName]);

  // Поиск на бэкенде один и тот же для списка клиентов и для подсказки:
  // имя, организация, почта, телефон — включая другой формат записи номера.
  const suggestQuery = useQuery({
    queryKey: ["client-suggestions", suggestTerm],
    enabled: suggestOpen && suggestTerm.length >= SUGGEST_MIN_CHARS,
    staleTime: 30_000,
    queryFn: () =>
      clientRequest<Envelope<Client[]>>(
        `/clients?page=1&size=${SUGGEST_LIMIT}&search=${encodeURIComponent(suggestTerm)}`,
      ),
  });

  const suggestions = suggestOpen ? (suggestQuery.data?.data ?? []) : [];

  // Клик мимо закрывает список — иначе он перекрывает поля под собой.
  useEffect(() => {
    if (!suggestOpen) return undefined;
    const handlePointerDown = (event: MouseEvent) => {
      if (!suggestBoxRef.current?.contains(event.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [suggestOpen]);

  const applySuggestion = (item: Client) => {
    setSelectedClient(item);
    setClientName(item.full_name);
    // Пустые поля клиента не затирают уже набранное менеджером: он мог
    // записать организацию или телефон, которых в карточке ещё нет. Раньше
    // организация была единственным полем без этой защиты — выбор клиента с
    // пустой организацией в базе молча стирал уже вписанную вручную.
    if (item.organization) setOrganization(item.organization);
    if (item.phone) setPhone(item.phone);
    if (item.email) setEmail(item.email);
    if (item.address) {
      setAddress(item.address);
      setAddressFromCard(true);
    }
    setSuggestOpen(false);
    setHighlight(-1);
  };

  const changeClientName = (value: string) => {
    setClientName(value);
    setSuggestOpen(value.trim().length >= SUGGEST_MIN_CHARS);
    setHighlight(-1);
    // Имя переписали — значит, это уже не тот клиент, что был выбран.
    if (selectedClient && value.trim() !== selectedClient.full_name) {
      setSelectedClient(null);
    }
  };

  const handleClientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSuggestOpen(false);
      setHighlight(-1);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && highlight >= 0) {
      // Enter подставляет клиента, только если менеджер сам встал на строку
      // стрелками. Иначе он печатает дальше, как будто подсказки нет.
      event.preventDefault();
      applySuggestion(suggestions[highlight]);
    }
  };

  // Почта проверяется до отправки: сервер отклоняет адрес без «@», и раньше
  // менеджер получал в ответ только код ошибки, не понимая, какое поле не так.
  const emailError =
    email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "Нужен адрес с «@», например ivan@mail.ru. Или оставьте поле пустым"
      : null;

  // Без слова «Заявка» в начале: над заголовком карточки и так стоит плашка
  // «ЗАЯВКА З-0004», а лишнее слово удлиняло строку вдвое без пользы.
  const subject = useMemo(() => {
    const clientLabel = clientName.trim() || "Новый клиент";
    const sizeLabel = totals.quantity ? `${totals.quantity} дет.` : "без размеров";
    return `${clientLabel} — ${sizeLabel}`;
  }, [clientName, totals.quantity]);

  const mutation = useMutation({
    mutationFn: async () =>
      clientRequest<Envelope<Lead>>("/leads/intake", {
        method: "POST",
        body: JSON.stringify({
          source_channel: sourceChannel,
          lead_number: leadNumber.trim() || null,
          // Срок принимался приёмом и раньше, но с формы не уходил вовсе —
          // поэтому «Дата выдачи ориентировочная» в бланке печаталась пустой, а
          // срок ставили вторым заходом, уже в карточке заявки.
          due_date: dueDate,
          // Направление уходит отдельным полем заявки, а не только типом работ
          // в строках: по нему заявка попадает в свой список, в отчёт и
          // получает букву в номере заказа.
          direction_code: directionCode || null,
          subject,
          text: [
            clientName ? `Клиент: ${clientName}` : null,
            organization ? `Организация: ${organization}` : null,
            phone ? `Телефон: ${phone}` : null,
            email ? `Email: ${email}` : null,
            address ? `Адрес: ${address}` : null,
            filledRows.length
              ? `Размеры:\n${filledRows
                  .map(
                    (row) =>
                      `${row.length}x${row.width} — ${rowQuantity(row)} шт.` +
                      `${row.thickness.trim() ? `, ${row.thickness.trim()} мм` : ""}` +
                      `${row.color.trim() ? `, ${row.color.trim()}` : ""}`,
                  )
                  .join("\n")}`
              : null,
            totals.quantity ? `Всего деталей: ${totals.quantity}` : null,
            totals.amount ? `Расчёт: ${totals.amount.toFixed(2)} ₽` : null,
            note || null,
          ]
            .filter(Boolean)
            .join("\n"),
          sender: {
            full_name: clientName || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            // Раньше организация уходила только текстом внутри заявки — до
            // карточки клиента не доезжала ни при заведении нового, ни при
            // довыборе существующего.
            organization: organization || null,
            // Клиент выбран из базы — заявка должна лечь на него. Сейчас сервер
            // узнаёт того же клиента по подставленным телефону и почте; id едет
            // рядом, чтобы привязка работала и у клиента без контактов.
            client_id: selectedClient?.id ?? null,
          },
          raw_payload: {
            quantity: totals.quantity || 1,
            client_id: selectedClient?.id ?? null,
            organization: organization || null,
            // первая позиция едет в dimensions, чтобы сводка считалась и по
            // разобранным размерам; полный список — в parts
            dimensions: filledRows.length
              ? {
                  width: Number(filledRows[0].length.replace(",", ".")),
                  height: Number(filledRows[0].width.replace(",", ".")),
                  depth: null,
                }
              : {},
            // Форма позиции та же, что читают печать бланка и раскрой. Поля
            // расчёта пишем только когда цена действительно есть: заявка без
            // расчёта должна остаться такой же, как была раньше.
            parts: rowsToSend.map((row) => {
              const price = rowUnitPrice(row, priceItems);
              const item = row.priceItemId
                ? priceItems.find((candidate) => candidate.id === row.priceItemId)
                : undefined;
              const typedArticle = row.articleText.trim();
              // Размеров нет — это не деталь, а строка расчёта («доставка»,
              // «гнутьё», просто запомненный артикул). Шлём размеры как null:
              // по ним и печать бланка, и раскрой такую строку пропускают, а
              // подсказки и смета её видят.
              const sized = isRowFilled(row);
              return {
                width: sized ? Number(row.length.replace(",", ".")) : null,
                height: sized ? Number(row.width.replace(",", ".")) : null,
                quantity: sized ? rowQuantity(row) : Math.max(1, rowQuantity(row)),
                ...(row.color.trim() ? { material: row.color.trim() } : {}),
                ...(row.thickness.trim() ? { thickness: row.thickness.trim() } : {}),
                ...(row.milling.trim() ? { milling: row.milling.trim() } : {}),
                // Артикул уходит всегда, как только он набран.
                //
                // Заказчик: «вручную прописываю артикул, например 128 — и он
                // должен сохраниться, а потом уже можно будет из списка его
                // выбирать». Раньше артикул писался только вместе с ценой и
                // только при выбранном направлении, поэтому на заявке без
                // расчёта он пропадал молча — номер набрали, а в подсказках
                // его нет.
                //
                // Тип работ едет рядом и только как уточнение: он нужен, чтобы
                // номенклатура завелась в своей части прайса. Без выбранного
                // направления типа не будет, но артикул сохранится всё равно.
                ...(item
                  ? { article: item.article, kind: item.kind }
                  : typedArticle
                    ? {
                        article: typedArticle,
                        ...(directionKind ? { kind: directionKind } : {}),
                      }
                    : {}),
                ...(price > 0
                  ? {
                      // Строка без размеров продаётся штуками: умножать цену на
                      // нулевую площадь значило бы увести позицию в 0 ₽ и молча
                      // занизить сумму заказа.
                      unit: sized ? rowUnit(row, priceItems) : "pcs",
                      unit_price: price.toFixed(2),
                      amount: sized
                        ? rowAmount(row, priceItems).toFixed(2)
                        : (price * Math.max(1, rowQuantity(row))).toFixed(2),
                      area_sqm: sized ? rowArea(row).toFixed(6) : "0",
                    }
                  : {}),
              };
            }),
            facade_area_sqm: totals.areaSqm.toFixed(3),
            // Итог расчёта попадает в сводку заявки как «оценка» — сумму
            // «на глазок» здесь не выдумываем, поэтому без цен поля нет.
            ...(totals.amount > 0
              ? { estimate: { final_amount: totals.amount.toFixed(2), currency: "RUB" } }
              : {}),
            manual_note: note || null,
          },
        }),
      }),
    // Сразу уводим в карточку созданной заявки: там номер, площадь, состав.
    // Если менеджер нажал «Создать и раскроить», открываем раскрой по этой
    // заявке — детали там уже разложены, вводить их второй раз не нужно.
    // Если нажал «Создать заказ» — заводим заказ этим же действием и уводим
    // прямо в него, без промежуточной остановки на карточке заявки.
    onSuccess: async (response) => {
      setError(null);
      const leadId = response.data.id;
      if (submitMode === "order") {
        try {
          const order = await clientRequest<Envelope<{ id: string }>>(
            `/leads/${leadId}/create-order`,
            { method: "POST", body: JSON.stringify({}) },
          );
          // Оплата при создании — необязательная и не должна сорвать переход
          // в заказ, даже если сумма кривая или сервер её не принял: заказ
          // уже создан, деньги дописать можно и с его карточки.
          const paidAmount = Number(initialPaymentAmount.replace(",", ".").trim());
          if (initialPaymentAmount.trim() && Number.isFinite(paidAmount) && paidAmount > 0) {
            try {
              await clientRequest(`/orders/${order.data.id}/payments`, {
                method: "POST",
                body: JSON.stringify({
                  amount: paidAmount.toFixed(2),
                  method: initialPaymentMethod,
                  comment: "Внесено при создании заказа",
                }),
              });
            } catch {
              // Заказ важнее платежа: платёж дописывается вручную на его
              // карточке, туда и уводим независимо от исхода.
            }
          }
          router.push(`/orders/${order.data.id}`);
          return;
        } catch (orderError) {
          // Заявка уже создана и не потеряна — просто уводим на её карточку,
          // а не оставляем менеджера ни с чем перед голой ошибкой.
          setError(
            orderError instanceof Error
              ? `Заявка создана, но заказ — нет: ${orderError.message}`
              : "Заявка создана, но заказ — нет",
          );
          router.push(`/leads/${leadId}`);
          return;
        }
      }
      router.push(submitMode === "cutting" ? `/film-cutting?leadId=${leadId}` : `/leads/${leadId}`);
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    },
  });

  return (
    <Card className={compact ? "space-y-4" : "space-y-5"}>
      <div className="space-y-2">
        <Badge className="bg-amber-100 text-slate-700">Прием заявки</Badge>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm leading-6 text-slate-700">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Подсказка из базы: один и тот же заказчик не должен заводиться
            заново под «Агат-Сервис», «агат сервис» и «ООО Агат». */}
        <div className="space-y-2 text-sm text-slate-700" ref={suggestBoxRef}>
          <label htmlFor="lead-client-name">Клиент</label>
          <div className="relative">
            <Input
              id="lead-client-name"
              value={clientName}
              onChange={(event) => changeClientName(event.target.value)}
              onKeyDown={handleClientKeyDown}
              onFocus={() => {
                if (clientName.trim().length >= SUGGEST_MIN_CHARS && !selectedClient) {
                  setSuggestOpen(true);
                }
              }}
              // Ушли табом — список закрывается. Иначе он оставался висеть над
              // полем «Телефон», и номер набирался вслепую под ним.
              onBlur={(event) => {
                if (!suggestBoxRef.current?.contains(event.relatedTarget as Node)) {
                  setSuggestOpen(false);
                  setHighlight(-1);
                }
              }}
              placeholder="Имя клиента"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls="lead-client-suggestions"
            />
            {suggestions.length ? (
              <ul
                id="lead-client-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
              >
                {suggestions.map((item, index) => (
                  <li key={item.id} role="option" aria-selected={index === highlight}>
                    <button
                      type="button"
                      className={`block w-full px-4 py-2 text-left transition ${
                        index === highlight ? "bg-amber-50" : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => applySuggestion(item)}
                    >
                      <span className="block font-medium text-slate-900">{item.full_name}</span>
                      {suggestionHint(item) ? (
                        <span className="block text-xs text-slate-500">{suggestionHint(item)}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {selectedClient ? (
            <span className="flex items-center gap-1 text-xs text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" />
              Клиент из базы — заявка добавится в его историю
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 text-slate-400 transition hover:text-slate-700"
                onClick={() => setSelectedClient(null)}
                aria-label="Отвязать клиента и создать нового"
                title="Создать нового клиента"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span className="block text-xs text-slate-500">
              С двух символов покажем совпадения из базы
            </span>
          )}
        </div>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Организация</span>
          <Input
            value={organization}
            onChange={(event) => setOrganization(event.target.value)}
            placeholder="если заказ от компании"
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Телефон</span>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7..." />
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Email</span>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="если есть"
            className={emailError ? "border-red-400 focus:border-red-400" : undefined}
          />
          {emailError ? <span className="block text-xs text-red-600">{emailError}</span> : null}
        </label>
        {/* Адрес объекта: спрашивают в первом разговоре, а занести было некуда.
            Занимает всю ширину — адрес длиннее телефона и в узкое поле не влезал. */}
        <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
          <span>Адрес</span>
          <Input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setAddressFromCard(false);
            }}
            placeholder="город, улица, дом — куда везти"
          />
          {selectedClient && addressFromCard ? (
            <span className="block text-xs text-slate-500">Адрес из карточки клиента</span>
          ) : null}
        </label>
        {/* Свой номер заявки: заказчик ведёт нумерацию сам и не мог её задать —
            номер вставал автоматом и не правился. */}
        <label className="space-y-2 text-sm text-slate-700">
          <span>Номер заявки</span>
          <Input
            value={leadNumber}
            onChange={(event) => setLeadNumber(event.target.value)}
            placeholder={nextNumberHint ? `следующий: ${nextNumberHint}` : "оставьте пустым — поставим сами"}
          />
          {nextNumberHint ? (
            <span className="block text-xs text-slate-500">
              Пусто — встанет {nextNumberHint}, смотреть в списке не нужно.
            </span>
          ) : null}
        </label>
        {/* Срок: заказчик — «вписали 14 дней, и отсчёт пошёл», и отдельно —
            «сроки вписать чтобы можно было ставить, ориентир даты
            изготовления». Два способа: дни — так срок называют по телефону, и
            дата напрямую — когда клиент назвал точный день. Дата главнее: см.
            useMemo выше. */}
        <label className="space-y-2 text-sm text-slate-700">
          <span>Срок</span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-20"
              value={dueDays}
              onChange={(event) => {
                setDueDays(event.target.value);
                // Дни вписали заново — значит, отдельно поставленная дата уже
                // не то, что имели в виду, а старая прикидка.
                setDueDateManual("");
              }}
              inputMode="numeric"
              placeholder="14"
              aria-label="Срок в днях от сегодня"
            />
            <span className="text-xs text-slate-500">дней от сегодня, или дата:</span>
            <Input
              type="date"
              className="w-40"
              value={dueDateManual || dueDate || ""}
              onChange={(event) => setDueDateManual(event.target.value)}
              aria-label="Срок датой"
            />
          </div>
          <span className="block text-xs text-slate-500">
            {dueDate
              ? `Сдать до ${formatDateOnly(dueDate)}`
              : "Пусто — срок поставите в карточке заказа"}
          </span>
        </label>
        <label className="space-y-2 text-sm text-slate-700">
          <span>Источник</span>
          <select
            className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
            value={sourceChannel}
            onChange={(event) => setSourceChannel(event.target.value)}
          >
            {channelOptions.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {directionOptions.length ? (
          <label className="space-y-2 text-sm text-slate-700">
            {/* «Направление», а не «тип работ»: заказчик прочитал «тип работ»
                как вид обработки и ждал там фрезеровку с мылом. Здесь выбирают
                одно из трёх производств — по нему идёт буква номера. */}
            <span>Направление</span>
            <select
              className="flex h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-400"
              value={directionCode}
              onChange={(event) => setDirectionCode(event.target.value)}
            >
              <option value="">не выбрано</option>
              {directionOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-slate-500">
              {directionCode
                ? "Заказ получит букву направления, номера артикулов лягут сюда же"
                : "Эмаль, ПВХ или шпон — от этого буква в номере заказа"}
            </span>
          </label>
        ) : null}
      </div>

      {/* Та же таблица, что студия печатает на бумаге: колонки и порядок
          повторяют бланк заказа, поэтому цех получает привычный лист, а
          менеджер не переносит цифры между двумя разными формами. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">Позиции заказа</p>
            <p className="text-xs text-slate-500">
              Те же колонки, что в бумажном бланке. Площадь и итоги считаются сами.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setBulkOpen((current) => !current)}
              className="rounded-full px-3 py-1 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
            >
              {bulkOpen ? "Скрыть вставку списком" : "Вставить списком"}
            </button>
            {/* Цены живут в справочнике: менять их в заявке нельзя, иначе
                у каждого менеджера будет свой прайс */}
            <Link
              href="/admin/price-book"
              className="rounded-full px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Изменить цены
            </Link>
          </div>
        </div>

        <LeadPartsTable
          rows={rows}
          onChange={applyRows}
          priceItems={priceItems}
          // Колонка «Артикул» есть всегда, даже когда прайс пуст. На боевой
          // базе он как раз пуст, и колонки физически не было: заказчик не мог
          // набрать номер, с которого справочник и начинает наполняться.
          showCalculator
          colorOptions={referenceValues?.colors ?? []}
          millingOptions={referenceValues?.millings ?? []}
          articleOptions={referenceValues?.articles ?? []}
        />
      </div>

      {bulkOpen ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Вставить размеры списком</p>
          <textarea
            className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none transition focus:border-amber-400"
            value={bulkInput}
            onChange={(event) => setBulkInput(event.target.value)}
            placeholder={"560 123 3\n610 120 5 | Эмаль RAL 9003 | 19 | фрез"}
            spellCheck={false}
          />
          <p className="text-xs text-slate-500">
            Одна строка — длина, ширина и количество. Разделитель: пробел, x или *. После «|» —
            цвет, толщина, фрезеровка.
          </p>
          {parsedBulk.errors.length ? (
            <p className="text-sm text-red-600">
              Не разобрались строки:{" "}
              {parsedBulk.errors.map((item) => `${item.line} («${item.source}»)`).join(", ")}
            </p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!parsedBulk.lines.length}
            onClick={() => {
              appendRows(
                parsedBulk.lines.map((line) =>
                  createLeadPartRow({
                    length: String(line.width),
                    width: String(line.height),
                    quantity: String(line.quantity),
                    thickness: line.thickness ?? "",
                    milling: line.milling ?? "",
                    color: line.material ?? "",
                  }),
                ),
              );
              setBulkInput("");
              setBulkOpen(false);
            }}
          >
            Добавить {parsedBulk.lines.length || ""} строк в таблицу
          </Button>
        </div>
      ) : null}

      {/* Бланк заказа приходит файлом — размеры не набивают заново.
          Строки дописываются к уже набранным, а не затирают их. */}
      <SpreadsheetDropZone
        title="Или загрузите бланк заказа"
        hint="Перетащите .xlsx, .xls или .csv — строки лягут прямо в таблицу"
        onParsed={(result) => {
          // Строки из файла дописываются к уже набранным, а не затирают их:
          // менеджер мог занести часть позиций руками до загрузки.
          appendRows(
            result.parts.map((part) =>
              createLeadPartRow({
                length: String(part.width),
                width: String(part.height),
                quantity: String(part.quantity),
                thickness: part.thickness ?? "",
                milling: part.milling ?? "",
                color: part.color ?? "",
              }),
            ),
          );
          // имя заказчика из шапки бланка — но только в пустое поле,
          // набранное менеджером вручную важнее того, что написано в файле
          if (result.customer) {
            setClientName((current) => (current.trim() ? current : result.customer ?? ""));
          }
        }}
      />

      <label className="space-y-2 text-sm text-slate-700">
        <span>Что нужно клиенту</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-400"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Материал, цвет, сроки, пожелания клиента."
        />
      </label>

      {/* Оплата при создании — необязательная, работает только вместе с
          кнопкой «Создать заказ»: у «Только заявки» и «Создать и раскроить»
          заказа ещё нет, платить не на что. Заказчик: «оплата при создании
          заказа сделать и отметки по суммам, которые были введены». */}
      {paymentMethods.length ? (
        <div className="space-y-2 rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="text-sm font-medium text-slate-900">
            Оплата при создании <span className="font-normal text-slate-500">(необязательно)</span>
          </p>
          <p className="text-xs text-slate-500">
            Применится только с кнопкой «Создать заказ» — платёж запишется в новый заказ сразу.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <NumberInput
              value={initialPaymentAmount}
              onChange={(event) => setInitialPaymentAmount(event.target.value)}
              placeholder="Сумма, ₽"
              aria-label="Сумма оплаты при создании заказа"
              measure="money"
              className="w-40"
            />
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((item) => (
                <label
                  key={item.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition",
                    initialPaymentMethod === item.code
                      ? "border-amber-400 bg-amber-400 text-slate-900"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <input
                    type="radio"
                    name="initial-payment-method"
                    className="h-3.5 w-3.5 accent-slate-900"
                    checked={initialPaymentMethod === item.code}
                    onChange={() => setInitialPaymentMethod(item.code)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {partsError ? <p className="text-sm text-red-600" role="alert">{partsError}</p> : null}

      <div className="flex flex-wrap gap-3">
        {/* Первая кнопка — тот самый сценарий «ввёл детали → нажал → получил
            заказ», без остановки на отдельной карточке заявки за отдельным
            вторым кликом. Заявка при этом всё равно заводится — заказ без неё
            не бывает, просто менеджер её отдельно не открывает. */}
        <Button
          onClick={() => {
            setSubmitMode("order");
            mutation.mutate();
          }}
          disabled={mutation.isPending || emailError !== null || partsError !== null}
        >
          <FilePlus2 className="mr-2 h-4 w-4" />
          {mutation.isPending && submitMode === "order" ? "Создаём…" : "Создать заказ"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setSubmitMode("lead");
            mutation.mutate();
          }}
          disabled={mutation.isPending || emailError !== null || partsError !== null}
        >
          {mutation.isPending && submitMode === "lead" ? "Создаём…" : "Только заявка"}
        </Button>
        {/* Раскрой по этой же заявке: детали туда приезжают сами, набирать
            размеры второй раз не нужно */}
        <Button
          variant="outline"
          disabled={mutation.isPending || emailError !== null || partsError !== null || !filledRows.length}
          onClick={() => {
            setSubmitMode("cutting");
            mutation.mutate();
          }}
        >
          <Calculator className="mr-2 h-4 w-4" />
          {mutation.isPending && submitMode === "cutting" ? "Создаём…" : "Создать и раскроить"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/film-cutting">Пустой раскрой</Link>
        </Button>
      </div>
    </Card>
  );
}
