import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    // xl:flex-wrap — чтобы кнопки уходили на свою строку, а не отжимали
    // заголовок. Без этого блок кнопок (на карточке заявки их пять) забирал
    // ширину себе, и заголовку оставалось 404 px из 1920: он обрезался
    // многоточием там, где места хватало с запасом.
    <div className="panel flex min-w-0 flex-col gap-5 p-5 md:p-6 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between">
      <div className="min-w-0 space-y-3">
        <Badge className="bg-amber-100 text-slate-700">{eyebrow}</Badge>
        <div className="min-w-0 space-y-2">
          {/* Заголовок всегда в одну строку. Тема заявки собирается из имени
              клиента и числа деталей и бывает длинной: на узком экране она
              разъезжалась на пять строк и выдавливала всё остальное вниз.
              Кегль уменьшается на узком экране, а что всё же не влезло —
              обрезается многоточием, полный текст остаётся в подсказке. */}
          <h1 className="truncate text-2xl sm:text-3xl md:text-4xl" title={title}>
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
