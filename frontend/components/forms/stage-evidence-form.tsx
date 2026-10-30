"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientRequest } from "@/lib/client-api";

type Props = {
  stageId: string;
};

export function StageEvidenceForm({ stageId }: Props) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        return null;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("evidence_type", "photo");
      if (comment.trim()) {
        formData.append("comment", comment.trim());
      }
      return clientRequest(`/production/stages/${stageId}/evidence`, {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      setComment("");
      setFile(null);
      router.refresh();
    },
  });

  return (
    <div className="space-y-3">
      <Input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <Input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Комментарий к фото"
      />
      <Button variant="outline" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "Загрузка..." : "Добавить фото"}
      </Button>
    </div>
  );
}
