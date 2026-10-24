import { useState } from "react";
import Button from "../components/ui/button";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "../components/ui/dialog";

export default function ProposalConfirm({
  label,
  description,
  busy,
  error,
  reasonRequired = false,
  onConfirm,
}: {
  label: string;
  description: string;
  busy: boolean;
  error: string;
  reasonRequired?: boolean;
  onConfirm: (reason: string, done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={busy}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{label} 확인</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {reasonRequired && (
          <div className="field-stack">
            <Label htmlFor="proposal-reason">종료 사유 (필수)</Label>
            <Textarea
              id="proposal-reason"
              value={reason}
              maxLength={4000}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            돌아가기
          </Button>
          <Button
            disabled={busy || (reasonRequired && !reason.trim())}
            onClick={() => onConfirm(reason.trim(), () => setOpen(false))}
          >
            {busy ? "처리 중…" : `${label} 확정`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
